from pathlib import Path
import subprocess
current = Path('patch_seed.py').read_bytes()
head = subprocess.check_output(['git', 'show', 'HEAD:patch_seed.py'])
print('match without conversion', current == head)
head_crlf = head.replace(b"\n", b"\r\n")
print('match with crlf', current == head_crlf)
print('len current', len(current))
print('len head_crlf', len(head_crlf))
