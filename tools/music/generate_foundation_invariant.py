from pathlib import Path
import math, wave, struct

SR = 44100
BPM = 72
BEAT = 60 / BPM

NOTE = {
    "C2":65.406, "G2":97.999, "A2":110.000, "F2":87.307,
    "C3":130.813, "D3":146.832, "E3":164.814, "F3":174.614, "G3":195.998, "A3":220.000, "B3":246.942,
    "C4":261.626, "D4":293.665, "E4":329.628, "F4":349.228, "G4":391.995, "A4":440.000, "B4":493.883,
    "C5":523.251, "D5":587.330, "E5":659.255, "G5":783.991
}

def env(i, n, attack=0.02, release=0.08):
    a = min(1.0, i / max(1, int(SR * attack)))
    r = min(1.0, (n - i) / max(1, int(SR * release)))
    return max(0.0, min(a, r))

def osc(freq, t, kind="warm"):
    if kind == "warm":
        return (math.sin(2*math.pi*freq*t) + 0.32*math.sin(4*math.pi*freq*t) + 0.12*math.sin(6*math.pi*freq*t)) / 1.44
    if kind == "glass":
        return (math.sin(2*math.pi*freq*t) + 0.22*math.sin(6*math.pi*freq*t) + 0.08*math.sin(10*math.pi*freq*t)) / 1.30
    if kind == "bass":
        return (math.sin(2*math.pi*freq*t) + 0.20*math.sin(4*math.pi*freq*t)) / 1.20
    return math.sin(2*math.pi*freq*t)

def add_tone(buf, start_beat, dur_beats, note, amp, kind="warm", pan=0.0):
    start = int(start_beat * BEAT * SR)
    n = int(dur_beats * BEAT * SR)
    f = NOTE[note]
    for i in range(n):
        j = start + i
        if j >= len(buf[0]): break
        t = i / SR
        e = env(i, n)
        s = amp * e * osc(f, t, kind)
        buf[0][j] += s * (1.0 - max(0.0, pan))
        buf[1][j] += s * (1.0 + min(0.0, pan))

def add_kick(buf, beat_pos, amp=0.45):
    start = int(beat_pos * BEAT * SR)
    n = int(0.35 * SR)
    for i in range(n):
        j = start + i
        if j >= len(buf[0]): break
        t=i/SR
        f = 95 - 55*(i/n)
        e = math.exp(-12*t)
        s = amp * e * math.sin(2*math.pi*f*t)
        buf[0][j]+=s; buf[1][j]+=s

def add_hat(buf, beat_pos, amp=0.08):
    start=int(beat_pos*BEAT*SR)
    n=int(0.10*SR)
    seed=2463534242
    for i in range(n):
        j=start+i
        if j>=len(buf[0]): break
        seed ^= (seed << 13) & 0xffffffff
        seed ^= (seed >> 17)
        seed ^= (seed << 5) & 0xffffffff
        noise=((seed & 0xffff)/32768.0)-1.0
        e=math.exp(-38*(i/SR))
        s=amp*e*noise
        buf[0][j]+=s; buf[1][j]+=s

def render(path):
    bars = 56
    total_beats = bars * 4
    total_samples = int((total_beats * BEAT + 2.0) * SR)
    buf = [[0.0]*total_samples, [0.0]*total_samples]
    progression = [("C2", ["C3","E3","G3"]),("G2", ["G3","B3","D4"]),("A2", ["A3","C4","E4"]),("F2", ["F3","A3","C4"])]
    motif = [("E4",1),("G4",1),("A4",2),("G4",1),("E4",1),("D4",2)]
    for bar in range(0, 12):
        root, chord = progression[bar % 4]; b = bar*4
        add_tone(buf,b,4,root,0.10,"bass")
        for idx,n in enumerate(chord): add_tone(buf,b,4,n,0.035,"glass",pan=(-0.45+idx*0.45))
        if bar in (2,5,8,11):
            pos=b
            for note,dur in motif: add_tone(buf,pos,dur,note,0.11,"warm",pan=0.12); pos += dur
    for bar in range(12, 28):
        root, chord = progression[bar % 4]; b=bar*4
        add_tone(buf,b,4,root,0.15,"bass")
        for idx,n in enumerate(chord): add_tone(buf,b,4,n,0.055,"warm",pan=(-0.35+idx*0.35))
        add_kick(buf,b,0.30); add_kick(buf,b+2,0.25)
        for x in [0,1,2,3]: add_hat(buf,b+x,0.035)
        if bar % 2 == 0:
            pos=b
            for note,dur in [("E4",0.5),("G4",0.5),("A4",1),("C5",1),("B4",1)]: add_tone(buf,pos,dur,note,0.12,"glass",pan=-0.10); pos += dur
    for bar in range(28, 44):
        root, chord = progression[(bar+1) % 4]; b=bar*4
        add_tone(buf,b,4,root,0.18,"bass")
        for idx,n in enumerate(chord): add_tone(buf,b,4,n,0.07,"warm",pan=(-0.5+idx*0.5))
        for x in [0,1,2,3]: add_kick(buf,b+x,0.20 if x in [1,3] else 0.32); add_hat(buf,b+x+0.5,0.05)
        for k,n in enumerate(["C4","E4","G4","A4","G4","E4","D4","E4"]): add_tone(buf,b+k*0.5,0.48,n,0.095,"glass",pan=0.20 if k%2 else -0.20)
    for bar in range(44, 54):
        root, chord = progression[bar % 4]; b=bar*4
        add_tone(buf,b,4,root,0.21,"bass")
        for idx,n in enumerate(chord): add_tone(buf,b,4,n,0.085,"warm",pan=(-0.55+idx*0.55))
        for x in [0,1,2,3]: add_kick(buf,b+x,0.34); add_hat(buf,b+x+0.5,0.065)
        pos=b
        for note,dur in [("E4",0.5),("G4",0.5),("A4",1),("C5",1),("B4",0.5),("A4",0.5),("G4",1)]: add_tone(buf,pos,dur,note,0.145,"warm",pan=0.08); pos += dur
    b=54*4
    add_tone(buf,b,8,"C2",0.10,"bass")
    pos=b
    for note,dur in motif: add_tone(buf,pos,dur,note,0.14,"glass"); pos+=dur
    peak=max(max(abs(x) for x in buf[0]),max(abs(x) for x in buf[1]),1e-9)
    gain=0.92/peak
    with wave.open(str(path),"wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        frames=bytearray()
        for i in range(total_samples):
            for ch in range(2): frames += struct.pack("<h",int(max(-1,min(1,buf[ch][i]*gain))*32767))
        w.writeframes(frames)

if __name__=="__main__":
    render(Path("Foundation_Invariant_Full.wav"))
