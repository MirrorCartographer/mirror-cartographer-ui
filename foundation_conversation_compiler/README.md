# Foundation Conversation Compiler

Compiles exported conversations into deterministic timeline identities, literal fenced code blocks, recurring architectural principles, a machine-readable graph, and a readable source-code rendering.

This package never claims complete history unless the supplied corpus is complete.

## Run

```bash
python -m foundation_conversation_compiler.compiler conversations.json --out build/all-time
python -m foundation_conversation_compiler.compiler conversations.json --out build/last-two-years --since 2024-07-21
python -m unittest discover -s foundation_conversation_compiler/tests -v
```
