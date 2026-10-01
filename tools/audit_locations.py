import json,os,collections,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'.tools/python'))
import dnfile,struct
pe=dnfile.dnPE(r'C:\Program Files (x86)\Steam\steamapps\common\TCG Card Shop Simulator\Card Shop Simulator_Data\Managed\Assembly-CSharp.dll')
for t in pe.net.mdtables.TypeDef:
 if str(t.TypeName)=='EObjectType':
  ids={f.row_index:str(f.row.Name) for f in t.FieldList}
  print({struct.unpack('<i',c.Value.value)[0]:ids[c.Parent.row_index] for c in pe.net.mdtables.Constant if c.Parent.table.name=='Field' and c.Parent.row_index in ids})
s=json.loads((pathlib.Path(os.environ['USERPROFILE'])/'AppData/LocalLow/OPNeonGames/Card Shop Simulator/savedGames_Release0.json').read_text())
found=collections.Counter();examples={}
def walk(v,p):
 if isinstance(v,dict):
  if v.get('monsterType',0)>0 and 'borderType' in v:found[p.split('[')[0]]+=1;examples.setdefault(p.split('[')[0],p)
  for k,x in v.items():walk(x,p+'.'+k)
 elif isinstance(v,list):
  for i,x in enumerate(v):walk(x,p+'['+str(i)+']')
walk(s,'');print(found);print(examples)
