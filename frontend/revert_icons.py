import re

with open('replace_icons.py', 'r') as f:
    code = f.read()

# Extract the replacements dictionary text
start_idx = code.find('replacements = {')
end_idx = code.find('}', start_idx) + 1
dict_text = code[start_idx:end_idx]

# Execute to get the dict
local_env = {}
exec(dict_text, {}, local_env)
replacements = local_env['replacements']

# Invert it
inverse_replacements = {v: k for k, v in replacements.items()}

with open('src/data/navigation.ts', 'r') as f:
    content = f.read()

for k, v in inverse_replacements.items():
    content = content.replace(k, v)

with open('src/data/navigation.ts', 'w') as f:
    f.write(content)

print("Reverted sub-module icons successfully.")
