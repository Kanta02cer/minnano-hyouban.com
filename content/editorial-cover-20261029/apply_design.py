"""Final display adapter. Adds only two stylesheet links outside article content."""
from pathlib import Path
import argparse, hashlib, json, shutil, re
def sha(data): return hashlib.sha256(data).hexdigest()
def apply(output,bundle):
    output=Path(output);bundle=Path(bundle);m=json.loads((bundle/'manifest.json').read_text())
    assert m['edition']=='20261029-A6' and m['preview_revision']==6
    assert sha((bundle/'home.html').read_bytes())==m['home_sha256']
    for rel,digest in m['assets'].items():
        path=Path(rel);assert not path.is_absolute() and '..' not in path.parts
        source=bundle/'assets'/path;assert source.is_file() and not source.is_symlink() and sha(source.read_bytes())==digest
    links=''.join('<link rel="stylesheet" data-editorial-type="20261029" href="'+m['prefix']+f+'">' for f in ['font-round.css','article-round.css'])
    results=[]
    for p in output.rglob('*.html'):
        if p==output/'index.html':continue
        before=p.read_text()
        if re.search(r'<meta[^>]+(?:http-equiv=["\']refresh|content=["\'][^"\']*noindex)',before,re.I):continue
        normalized=before.replace(links,'')
        assert 'data-editorial-type=' not in normalized,'Unexpected typography version'
        assert normalized.count('</head>')==1
        after=normalized.replace('</head>',links+'</head>',1)
        assert after.replace(links,'')==normalized
        p.write_text(after);results.append({'path':p.relative_to(output).as_posix(),'before_sha256':sha(normalized.encode()),'after_sha256':sha(after.encode()),'only_stylesheet_links_added':True})
    shutil.copy2(bundle/'home.html',output/'index.html')
    for rel in m['assets']:
        dest=output/m['asset_directory']/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(bundle/'assets'/rel,dest)
    route='reports' if m['media']=='minnano' else 'articles'
    assert len(list((output/route).glob('*/index.html')))==m['article_count']
    return {'status':'passed','edition':m['edition'],'media':m['media'],'assets':len(m['assets']),'pages':results}
if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--output',required=True);ap.add_argument('--bundle',required=True);ap.add_argument('--record');args=ap.parse_args();result=apply(args.output,args.bundle)
    if args.record:Path(args.record).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'status':result['status'],'media':result['media'],'pages':len(result['pages']),'assets':result['assets']}))
