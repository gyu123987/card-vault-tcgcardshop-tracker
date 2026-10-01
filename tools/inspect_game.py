import sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]/'.tools/python'))
import dnfile
from dncil.cil.body import CilMethodBody
from dncil.cil.body.reader import CilMethodBodyReaderBytes
ROOT=pathlib.Path(r'C:\Program Files (x86)\Steam\steamapps\common\TCG Card Shop Simulator\Card Shop Simulator_Data')
pe=dnfile.dnPE(str(ROOT/'Managed/Assembly-CSharp.dll'))
def token(t):
    try:
        table=pe.net.mdtables.tables[t.table]
        r=table.rows[t.rid-1]
        return str(getattr(r,'Name',getattr(r,'TypeName',r)))
    except Exception:
        try: return str(pe.net.user_strings.get(t.value & 0xffffff))
        except: return str(t)
def dump(m):
    print('\nMETHOD',m.Name)
    if m.Rva:
        try:
            body=CilMethodBody(CilMethodBodyReaderBytes(pe.get_data(m.Rva,100000)))
            for i in body.instructions:
                op=i.operand
                print(i.offset,i.opcode,token(op) if hasattr(op,'table') else op)
        except Exception as e: print(e)
if len(sys.argv)>1:
    for t in pe.net.mdtables.TypeDef:
        for m in t.MethodList:
            if any(x.lower() in (str(t.TypeName)+'.'+str(m.row.Name)).lower() for x in sys.argv[1:]):
                print('TYPE',t.TypeName); dump(m.row)
else:
    for t in pe.net.mdtables.TypeDef:
        if any(x in str(t.TypeName).lower() for x in ['card','monster','deck','expansion']):
            print('\nTYPE',t.TypeName)
            print('FIELDS',', '.join(str(f.row.Name) for f in t.FieldList))
            print('METHODS',', '.join(str(m.row.Name) for m in t.MethodList))
