"""Developer diagnostic: resolve the card prefab hierarchy and its render assets."""
import sys,pathlib,json
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.tools/python'))
import UnityPy
from UnityPy.helpers import TypeTreeHelper
from UnityPy.helpers.TypeTreeGenerator import TypeTreeGenerator
TypeTreeHelper.read_typetree_boost=False
game=pathlib.Path(r'C:\Program Files (x86)\Steam\steamapps\common\TCG Card Shop Simulator\Card Shop Simulator_Data')
env=UnityPy.load(str(game/'sharedassets1.assets'))
gen=TypeTreeGenerator('2021.3.38f1');gen.load_local_dll_folder(str(game/'Managed'));env.typetree_generator=gen
objects=next(o.assets_file.objects for o in env.objects if o.path_id==87419)
ui=json.loads((ROOT/'.tools/sharedassets1.assets-87419.json').read_text())
out={};lines=[]
def read(i):
 o=objects[i]
 if o.type.name=='MonoBehaviour':
  f=ROOT/f'.tools/sharedassets1.assets-{i}.json'
  if f.exists():return json.loads(f.read_text())
 return o.read_typetree()
def walk(goid,depth=0):
 go=read(goid);rec={'id':goid,'name':go['m_Name'],'active':go['m_IsActive'],'components':[]};out[goid]=rec
 for p in go['m_Component']:
  i=p['component']['m_PathID'];o=objects[i]
  try:d=read(i)
  except Exception as e:d={'error':str(e)}
  rec['components'].append({'id':i,'type':o.type.name,'data':d})
 lines.append('  '*depth+str(goid)+' '+go['m_Name']+' '+str([(c['id'],c['type']) for c in rec['components']]))
 for c in rec['components']:
  if c['type'] in ('RectTransform','Transform'):
   for child in c['data'].get('m_Children',[]):
    tr=read(child['m_PathID']);walk(tr['m_GameObject']['m_PathID'],depth+1)
walk(ui['m_CardFront']['m_PathID'])
(ROOT/'.tools/card-layout.json').write_text(json.dumps({'ui':ui,'nodes':out},indent=2))
(ROOT/'.tools/card-tree.txt').write_text('\n'.join(lines))
print('\n'.join(lines))
