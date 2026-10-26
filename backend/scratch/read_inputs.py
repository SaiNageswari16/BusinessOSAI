import json

transcript_path = r'C:\Users\abhil\.gemini\antigravity-ide\brain\584a1c95-8b99-433a-8217-0426e9b14340\.system_generated\logs\transcript.jsonl'
inputs = []
with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            if data.get('type') == 'USER_INPUT':
                inputs.append((data.get('step_index'), data.get('content')))
        except Exception:
            pass

for idx, content in inputs[-8:]:
    print(f"=== Step {idx} ===")
    print(content)
    print("=" * 40)
