"""Read-only extraction from a locally installed copy of the game. No game files changed."""
import sys,pathlib,json,argparse,re
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
sys.path.insert(0,str(ROOT/'.tools/python'))
import UnityPy
from UnityPy.helpers import TypeTreeHelper
TypeTreeHelper.read_typetree_boost=False
from UnityPy.helpers.TypeTreeGenerator import TypeTreeGenerator
from UnityPy.classes.PPtr import PPtr
def fix(n):
 if n.m_Type=='string' and n.m_Children and n.m_Children[0].m_Type=='Array' and n.m_Children[0].m_Children[-1].m_Type=='string': n.m_Type='vector'
 for c in n.m_Children: fix(c)
parser=argparse.ArgumentParser()
parser.add_argument('--game',default=r'C:\Program Files (x86)\Steam\steamapps\common\TCG Card Shop Simulator')
parser.add_argument('--output', type=pathlib.Path, default=ROOT, help='Output root for local cache (never the game directory)')
args=parser.parse_args(); OUTPUT=args.output.resolve(); game=pathlib.Path(args.game)/'Card Shop Simulator_Data'
gen=TypeTreeGenerator('2021.3.38f1');gen.load_local_dll_folder(str(game/'Managed'))
env=UnityPy.load(str(game/'sharedassets1.assets'));env.typetree_generator=gen
source=None
for o in env.objects:
 if o.type.name!='MonoBehaviour':continue
 try:
  script=o.parse_monobehaviour_head().m_Script.read()
  if script.m_ClassName=='MonsterData_ScriptableObject':source=o;break
 except:pass
if source is None: raise RuntimeError('Card catalog not found in installed game')
node=source.generate_monobehaviour_node();fix(node);raw=source.read_typetree(nodes=node)
assets=OUTPUT/'public/assets';assets.mkdir(parents=True,exist_ok=True)
cache={}; errors=[]
def export(ptr):
 if not ptr or not ptr.get('m_PathID'):return None
 key=f"{ptr['m_FileID']}-{ptr['m_PathID']}"
 if key in cache:return cache[key]
 try:
  obj=PPtr(m_FileID=ptr['m_FileID'],m_PathID=ptr['m_PathID'],assetsfile=source.assets_file).read()
  dest=assets/f'{key}.webp'
  if True:
   im=obj.image
   if hasattr(obj,'m_Rect'):
    from PIL import Image
    rect=obj.m_Rect; off=obj.m_RD.textureRectOffset
    canvas=Image.new('RGBA',(round(rect.width),round(rect.height)))
    canvas.paste(im,(round(off.x),round(rect.height-off.y-im.height)))
    im=canvas
   im.thumbnail((800,800));im.save(dest,'WEBP',quality=92)
  cache[key]=f'/assets/{key}.webp'
 except Exception as e: errors.append(f'{key}: {e}');cache[key]=None
 return cache[key]
sets=[(0,'Tetramon','','m_ShownMonsterList','m_DataList',False),(1,'Destiny','Destiny','m_ShownMonsterList','m_DataList',False),(7,'Ascension','Ascension','m_ShownMonsterList','m_DataList',False),(2,'Ghost White','Ghost','m_ShownGhostMonsterList','m_DataList',False),(2,'Ghost Black','GhostBlack','m_ShownGhostMonsterList','m_DataList',True),(3,'Megabot','Megabot','m_ShownMegabotList','m_MegabotDataList',False),(4,'Fantasy RPG','FantasyRPG','m_ShownFantasyRPGList','m_FantasyRPGDataList',False),(5,'Cat Job','CatJob','m_ShownCatJobList','m_CatJobDataList',False)]
cards=[]; setinfo=[]; borders=['Base','First Edition','Silver','Gold','EX','Full Art']
from render_assets import build_render_assets
render_data=build_render_assets(env,source,raw,export,OUTPUT)
for expansion,name,suffix,shown,data,isDestiny in sets:
 sid=suffix or 'Tetramon'; monsters={m['MonsterType']:m for m in raw[data]}
 setting=next(s for s in raw['m_CardUISettingList'] if s['expansionType']==expansion)
 setinfo.append({'id':sid,'name':name,'expansion':expansion,'suffix':suffix,'isDestiny':isDestiny,'monsterOrder':raw[shown]})
 for pos,mid in enumerate(raw[shown]):
  m=monsters[mid];desc=m['Description'] or 'No effect'
  for token,axis in [('XXX','x'),('YYY','y'),('ZZZ','z')]:desc=desc.replace(token,f"{m['EffectAmount'][axis]:g}")
  icon=m['Icon'];bg=None
  ii=setting['iconIndex'];bi=setting['bgIndex']
  if ii and len(m['IconList'])>ii:icon=m['IconList'][ii]
  if expansion==2 and not icon.get('m_PathID'):icon=m['GhostIcon']
  if bi and len(m['BGList'])>bi:bg=m['BGList'][bi]
  count=2 if expansion==2 else 12
  for v in range(count):
   foil=v>=count//2;border=0 if expansion==2 else v%6
   candidates=list(enumerate(setting['cardUISettingDataList']))
   if isDestiny:candidates=candidates[len(candidates)//2:]
   style_index=next((i for i,s in candidates if border in s['applicableBorderList']),0)
   names=setting['cardUISettingDataList'][style_index]['cardBorderFullNameList']
   variant_name=(['Base','Silver','Gold','Silver Full Art','EX Full Art','Borderless Full Art'][border] if expansion==7 else borders[border])
   cards.append({'id':f'{sid}:{pos*count+v}','setId':sid,'set':name,'expansion':expansion,'isDestiny':isDestiny,'saveIndex':pos*count+v,'monsterId':mid,'baseId':str(mid),'name':m['Name'],'description':re.sub('<[^>]+>','',desc),'rarity':['Common','Rare','Epic','Legendary'][m['Rarity']] if m['Rarity']<4 else str(m['Rarity']),'rarityIndex':m['Rarity'],'number':pos*count+v+1,'cardNumber':pos+1,'variant':('Ghost' if expansion==2 else variant_name)+(' Foil' if foil else ''),'border':border,'foil':foil,'art':export(icon),'background':export(bg),'artist':m['ArtistNameList'][min(setting['artistNameIndex'],len(m['ArtistNameList'])-1)] if m['ArtistNameList'] else m['ArtistName'],'stats':{k:m['BaseStats'][k] for k in ['FireElement','EarthElement','WaterElement','WindElement']},'previousEvolution':m['PreviousEvolution'],'previousName':monsters.get(m['PreviousEvolution'],{}).get('Name',''),'previousArt':export(monsters.get(m['PreviousEvolution'],{}).get('Icon')),'renderStyle':f'{expansion}:{style_index}','elementIndex':m['ElementIndex']})
(OUTPUT/'data').mkdir(exist_ok=True)
from economy_assets import extract_economy
scene = UnityPy.load(str(game/'level1'));scene.typetree_generator=gen
economy = extract_economy(env, fix, scene)
(OUTPUT/'data/catalog.json').write_text(json.dumps({'sets':setinfo,'cards':cards,'economy':economy,'source':'Local game assets','unityVersion':'2021.3.38f1'},ensure_ascii=False),encoding='utf-8')
if errors: raise RuntimeError('Asset extraction failed; no cache should be published: '+ '; '.join(errors[:10]))
print(json.dumps({'cards':len(cards),'images':sum(bool(v) for v in cache.values()),'errors':errors[:10]}))
