#!/bin/sh
set -eu
exec python3 - "$@" <<'PY'
import argparse, base64, os, re, shutil, subprocess, sys
from pathlib import Path
from urllib.parse import quote_from_bytes, unquote_to_bytes, urlsplit

p = argparse.ArgumentParser()
p.add_argument("source", type=Path)
p.add_argument("revision")
p.add_argument("output", type=Path)
p.add_argument("--filter-repo", default="git-filter-repo")
p.add_argument("--literals", type=Path)
a = p.parse_args()
src, dst = a.source.resolve(), a.output.resolve()
env = {k:v for k,v in os.environ.items() if not k.startswith("GIT_")}
env.update(GIT_ALLOW_PROTOCOL="file", GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL=os.devnull,
           GIT_OPTIONAL_LOCKS="0", GIT_NO_REPLACE_OBJECTS="1", LC_ALL="C")
git = ["git", "-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false"]
def run(cmd, cwd, data=None):
    return subprocess.run(cmd, cwd=cwd, env=env, input=data, stdout=subprocess.PIPE,
                          stderr=subprocess.DEVNULL, check=True).stdout
def g(cwd, *args):
    return run(git + list(args), cwd)
def require(ok):
    if not ok:
        raise ValueError()
def snapshot():
    index = Path(os.fsdecode(g(src,"rev-parse","--git-path","index").strip()))
    return (g(src,"show-ref","--head"), (src/index).read_bytes(),
            g(src,"rev-parse","--abbrev-ref","HEAD"), g(src,"status","--porcelain=v1","-z"))
def clean():
    require(src != dst and src not in dst.parents and not any(dst.iterdir()))
    tool = shutil.which(a.filter_repo)
    require(tool)
    tool = str(Path(tool).resolve())
    rev = g(src,"rev-parse","--verify","--end-of-options",a.revision+"^{commit}").strip()
    branches = g(src,"for-each-ref","--contains",rev,"--format=%(refname:strip=2)","refs/heads").splitlines()
    branch = os.fsencode(a.revision) if os.fsencode(a.revision) in branches else next(iter(branches),None)
    # A detached commit may belong to no branch. Fetch it locally after cloning HEAD.
    args = ["--branch",branch] if branch else []
    g(src,"clone","--no-local","--single-branch","--no-tags","--no-checkout",*args,"--",src,dst)
    g(dst,"fetch","--no-tags","origin",rev)
    g(dst,"remote","remove","origin")
    g(dst,"checkout","--detach",rev)
    for ref in g(dst,"for-each-ref","--format=%(refname)").splitlines():
        g(dst,"update-ref","-d",ref)
    g(dst,"checkout","-b","main")
    def historic(path):
        return g(src,"show","109bbb8:"+path)
    dns = re.search(rb'^\s*-\s*"(https://[^"]+@[^"]+)"',historic("snippet/dns/basic.yaml"),re.M)[1]
    control = re.search(rb'^\s*control-url:\s*(\S+)',historic("snippet/proxies/tailscale.yaml"),re.M)[1].strip(b"'\x22")
    d, c = urlsplit(dns), urlsplit(control)
    rules = {}
    def add(value, replacement):
        require(value and len(value)>=4)
        for v in (value,unquote_to_bytes(value)):
            require(len(v)>=4)
            for form in (v,quote_from_bytes(v,safe="").encode(),base64.b64encode(v),v[::-1]):
                rules.setdefault(form,replacement)
    require(d.username and d.password and c.scheme and c.hostname)
    add(dns,b"{{{doh_url}}}")
    add(d.netloc.rsplit(b"@",1)[0],b"REDACTED_USERINFO")
    add(d.password,b"REDACTED_PASSWORD")
    add(control,b"{{{control_url}}}")
    add(c.hostname,b"control.invalid")
    if a.literals:
        import stat
        require(stat.S_ISREG(a.literals.stat().st_mode) and not a.literals.stat().st_mode & 0o077)
        require(subprocess.run(git+["rev-parse","--git-dir"], cwd=a.literals.resolve().parent, env=env,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode != 0)
        vals=a.literals.read_bytes().splitlines()
        require(vals)
        for v in vals:
            add(v,b"REDACTED_LITERAL")
    # Anonymous pipe carries replacement data. No secret in argv or on disk.
    import pickle
    callback = """import pickle, os, re
if not hasattr(os, '_clean_rules'):
    with os.fdopen(int(os.environ['CLEAN_RULES_FD']), 'rb') as f:
        os._clean_rules = pickle.load(f)
    os._clean_pat = re.compile(b'|'.join(map(re.escape, sorted(os._clean_rules,key=len,reverse=True))))
return os._clean_pat.sub(lambda m: os._clean_rules[m[0]], CONTENT)"""
    import threading
    r,w=os.pipe()
    def feed():
        with os.fdopen(w,"wb") as f:
            pickle.dump(rules,f)
    t=threading.Thread(target=feed,daemon=True)
    t.start()
    try:
        subprocess.run([tool,"--force","--preserve-commit-hashes","--preserve-commit-encoding",
                        "--prune-empty","never","--prune-degenerate","never",
                        "--message-callback",callback.replace("CONTENT","message"),
                        "--blob-callback",callback.replace("return os.","blob.data = os.").replace("CONTENT","blob.data")],
                       cwd=dst,env=dict(env,CLEAN_RULES_FD=str(r)),pass_fds=(r,),
                       stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True)
    finally:
        os.close(r)
    t.join()
    for name in ("FETCH_HEAD","ORIG_HEAD"):
        (dst/".git"/name).unlink(missing_ok=True)
    g(dst,"reflog","expire","--expire=now","--all")
    g(dst,"gc","--prune=now")
    refs=g(dst,"for-each-ref","--format=%(refname)").splitlines()
    require(refs==[b"refs/heads/main"] and not g(dst,"remote").strip())
    pat=re.compile(b"|".join(map(re.escape,rules)))
    count=hits=0
    with subprocess.Popen(git+["cat-file","--batch-all-objects","--batch"],cwd=dst,env=env,
                          stdout=subprocess.PIPE,stderr=subprocess.DEVNULL) as proc:
        while header:=proc.stdout.readline():
            size=int(header.split()[2])
            obj=proc.stdout.read(size)
            require(len(obj)==size and proc.stdout.read(1)==b"\n")
            hits+=len(pat.findall(obj))
            count+=1
        require(proc.wait()==0)
    print(f"refs={len(refs)} objects={count} matches={hits}",flush=True)
    require(hits==0)
try:
    before=snapshot()
    try:
        clean()
    finally:
        require(before==snapshot())
except Exception:
    sys.exit("清洗或验证失败")
PY
