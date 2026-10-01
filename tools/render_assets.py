"""Export Unity card-prefab layout and referenced sprites; no game files are modified."""
import json
from UnityPy.classes.PPtr import PPtr

def build_render_assets(env, source, raw, export, root):
    objects=source.assets_file.objects
    def ptrread(p):
        return PPtr(m_FileID=p['m_FileID'],m_PathID=p['m_PathID'],assetsfile=source.assets_file).read_typetree()
    ui_obj=None
    for o in objects.values():
        if o.type.name!='MonoBehaviour':continue
        try:
            if o.parse_monobehaviour_head().m_Script.read().m_ClassName=='CardUI':ui_obj=o;break
        except:pass
    if ui_obj is None:raise RuntimeError('CardUI prefab not found')
    ui=ui_obj.read_typetree()
    component_keys={p['m_PathID']:k for k,p in ui.items() if isinstance(p,dict) and 'm_PathID' in p}
    static={};nodes={}
    def walk(goid):
        go=objects[goid].read_typetree();node={'id':goid,'name':go['m_Name'],'active':bool(go['m_IsActive']),'children':[]}
        for cp in go['m_Component']:
            oid=cp['component']['m_PathID'];o=objects[oid]
            try:d=o.read_typetree()
            except:continue
            if o.type.name in ('RectTransform','Transform'):
                node['transform']=d
                for ch in d.get('m_Children',[]):node['children'].append(objects[ch['m_PathID']].read_typetree()['m_GameObject']['m_PathID'])
            if 'm_Sprite' in d:
                node['image']={'sprite':export(d['m_Sprite']),'color':d['m_Color'],'preserveAspect':bool(d.get('m_PreserveAspect')),'key':component_keys.get(oid),'type':d.get('m_Type',0)}
                static[node['name']]=node['image']['sprite']
            if 'm_ShowMaskGraphic' in d:node['mask']=True;node['showMask']=bool(d['m_ShowMaskGraphic'])
            if 'm_text' in d:
                node['text']={'value':d['m_text'],'fontSize':d.get('m_fontSize',20),'fontStyle':d.get('m_fontStyle',0),'align':d.get('m_HorizontalAlignment',1),'vertical':d.get('m_VerticalAlignment',256),'color':d.get('m_fontColor',d.get('m_Color')),'key':component_keys.get(oid)}
        node['key']=component_keys.get(goid)
        nodes[str(goid)]=node
        for ch in node['children']:walk(ch)
    walk(ui['m_CardFront']['m_PathID'])
    styles={}
    for setting in raw['m_CardUISettingList']:
        eid=setting['expansionType']
        for n,s in enumerate(setting['cardUISettingDataList']):
            out={}
            for k,v in s.items():
                if 'Material' in k:continue
                if isinstance(v,dict) and 'm_PathID' in v:
                    if 'Material' not in k and 'material' not in k:out[k]=export(v)
                elif isinstance(v,list) and v and isinstance(v[0],dict) and 'm_PathID' in v[0]:out[k]=[export(p) for p in v]
                else:out[k]=v
            styles[f'{eid}:{n}']=out
    icons={}
    for o in objects.values():
        if o.type.name=='Texture2D':
            try:
                name=o.peek_name()
                if name in ['Icon_Fire','Icon_Earth','Icon_Water','Icon_Wind']:
                    icons[name[5:].lower()]=export({'m_FileID':0,'m_PathID':o.path_id})
            except:pass
    font=None
    for o in env.objects:
        if o.type.name=='Font':
            try:
                d=o.read_typetree()
                if 'fredoka' in d.get('m_Name','').lower() and d.get('m_FontData'):
                    f=root/'public/assets/card-font.ttf';f.write_bytes(bytes(d['m_FontData']));font='/assets/card-font.ttf';break
            except:pass
    # These settings reference the real foil materials. Export texture inputs for browser sheen.
    materials={}
    for setting in raw['m_CardUISettingList']:
        for s in setting['cardUISettingDataList']:
            for p in s['foilMaterialTangentView']+s['foilBlendedMaterialTangentView']:
                if not p['m_PathID']:continue
                mid=f"{p['m_FileID']}-{p['m_PathID']}"
                if mid in materials:continue
                try:
                    d=ptrread(p);props=d['m_SavedProperties'];textures={}
                    for k,v in props.get('m_TexEnvs',[]):
                        tp=dict(v['m_Texture'])
                        if tp['m_FileID']==0:tp['m_FileID']=p['m_FileID']
                        textures[k]=export(tp)
                    materials[mid]={'name':d['m_Name'],'textures':textures,'floats':props.get('m_Floats',[])}
                except Exception as e:materials[mid]={'error':str(e)}
    result={'root':ui['m_CardFront']['m_PathID'],'nodes':nodes,'styles':styles,'icons':icons,'static':static,'font':font,'materials':materials}
    (root/'public/assets/render-data.json').write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8')
    print('Render assets:',len(styles),'styles;',len(nodes),'layout nodes; icons:',icons,'font:',font)
    return result
