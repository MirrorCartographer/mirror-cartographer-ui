#!/usr/bin/env python3
import argparse, hashlib, json, pathlib, re
SHA=re.compile(r'^sha256:[0-9a-f]{64}$')
def canon(v): return json.dumps(v,sort_keys=True,separators=(',',':')).encode()
def dg(v): return 'sha256:'+hashlib.sha256(canon(v)).hexdigest()
def stop(m): print(json.dumps({'status':'reject','reason':m},sort_keys=True)); raise SystemExit(1)
def req(c,m):
    if not c: stop(m)
a=argparse.ArgumentParser(); a.add_argument('plan'); p=a.parse_args(); v=json.loads(pathlib.Path(p.plan).read_text())
req(v.get('schema')=='fia.queue-authority.v1','schema'); u=dict(v); s=u.pop('plan_digest',None); req(s==dg(u),'plan digest mismatch')
req(v.get('canonical_authority')=='foundation','canonical authority')
b=v.get('broker',{}); req(b.get('implementation')=='rabbitmq' and b.get('major_version')==4,'broker'); req(b.get('nodes') in (3,5),'quorum size'); req(b.get('queue_type')=='quorum','queue type'); req(b.get('tls_required') is True,'tls'); req(b.get('management_public') is False,'management'); req(b.get('provider_is_not_authority') is True,'provider authority')
d=v.get('delivery',{}); req(d.get('publisher_confirms') is True,'confirms'); req(d.get('mandatory_publish') is True,'mandatory'); req(d.get('manual_consumer_ack') is True,'manual ack'); req(d.get('consumer_idempotency_required') is True,'idempotency'); req(d.get('delivery_semantics')=='at-least-once','delivery'); req(d.get('exactly_once_claimed') is False,'exactly-once claim')
bp=v.get('backpressure',{}); req(bp.get('overflow')=='reject-publish','overflow'); req(bp.get('max_length_bytes',0)>0,'queue bound'); req(bp.get('publisher_retry')=='bounded-jitter' and bp.get('retry_budget_seconds',0)>0,'retry'); req(bp.get('admission_shed_load') is True,'load shedding')
f=v.get('failure_handling',{}); req(f.get('dead_letter_strategy')=='at-least-once','dlx'); req(f.get('dead_letter_exchange') is True,'dlx exchange'); req(f.get('delivery_limit',0)>0,'delivery limit'); req(f.get('parking_stream') is True,'parking'); req(f.get('replay_tool')=='fia queue replay','replay'); req(f.get('duplicate_detection_window_seconds',0)>0,'duplicate window')
c=v.get('custody',{}); req(c.get('definitions_export') is True,'definitions'); req(c.get('message_archive') is True and c.get('archive_format')=='fia.message-archive.v1','archive'); req(c.get('archive_failure_domains',0)>=2,'archive domains'); req(c.get('offline_or_immutable_copy') is True,'offline'); req(SHA.match(c.get('archive_digest','')),'archive digest'); req(c.get('restore_drill')=='pass','restore'); req(c.get('second_operator') is True,'operator')
o=v.get('observability',{}); needed={'publish_confirm_latency','unconfirmed_publish_count','ready_message_count','unacked_message_count','redelivery_count','dead_letter_count','disk_free_alarm','memory_alarm','consumer_lag'}; req(needed.issubset(set(o.get('required_metrics',[]))),'metrics'); req(o.get('owned_telemetry_sink') is True,'telemetry authority')
m=v.get('migration',{}); req(all(m.get(k) is True for k in ('dual_publish_supported','shadow_consume_supported','digest_reconciliation','rollback_supported')),'migration')
print(json.dumps({'status':'accept','plan_digest':s,'nodes':b['nodes'],'archive_digest':c['archive_digest'],'delivery_semantics':d['delivery_semantics']},sort_keys=True))
