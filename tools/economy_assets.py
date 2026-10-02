"""Extract valuation tables from the player's local game; never ship the tables."""

def extract_economy(env, fix, scene=None):
    found = {}
    wanted = {'ShelfData_ScriptableObject', 'StockItemData_ScriptableObject',
              'UnlockRoomManager', 'ScannerRestockScreen'}
    for obj in [*env.objects, *(scene.objects if scene else [])]:
        if obj.type.name != 'MonoBehaviour':
            continue
        try:
            name = obj.parse_monobehaviour_head().m_Script.read().m_ClassName
        except Exception:
            continue
        if name not in wanted:
            continue
        node = obj.generate_monobehaviour_node()
        fix(node)
        found[name] = obj.read_typetree(nodes=node)
    stock = found.get('StockItemData_ScriptableObject', {})
    objects = found.get('ShelfData_ScriptableObject', {})
    if not stock.get('m_RestockDataList') or not objects.get('m_FurniturePurchaseDataList'):
        raise RuntimeError('Installed game economy tables could not be read')
    return {
        'version': 2,
        'items': [{'name': x['name'], 'baseCost': x['baseCost']}
                  for x in stock['m_ItemDataList']],
        'furniture': {str(x['objectType']): {'name': x['name'], 'price': x['price']}
                      for x in objects['m_FurniturePurchaseDataList']},
        'nonPurchasableTypes': [x['objectType'] for x in objects['m_ObjectDataList']
                               if x['objectType'] not in {p['objectType'] for p in objects['m_FurniturePurchaseDataList']}],
        'decorations': [{'name': x['name'], 'price': x['price']}
                        for x in objects['m_DecoPurchaseDataList']],
        'finishes': {kind: [x['price'] for x in objects['m_' + kind + 'DecoDataList']]
                     for kind in ('Wall', 'Floor', 'Ceiling')},
        'licenses': [{'name': x['name'], 'price': x['licensePrice']}
                     for x in stock['m_RestockDataList']],
        'shopBPrice': found.get('UnlockRoomManager', {}).get('m_ShopB_UnlockPrice'),
        # Nonserialized field initialized in ScannerRestockScreen..ctor.
        'scannerPrice': found.get('ScannerRestockScreen', {}).get('m_UnlockCost', 12000),
    }
