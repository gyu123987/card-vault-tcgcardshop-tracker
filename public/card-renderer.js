const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const renderData=await fetch('/assets/render-data.json').then(r=>r.json());
let serial=0;
export function cardArtwork(c){
 const s=renderData.styles[c.renderStyle];if(!s)return `<img src="${c.art}" alt="${escape(c.name)}">`;
 const uid=`card${++serial}`,defs=[];
 const img=(url,w,h,p,opacity=1)=>url?`<image href="${url}?canvas=2" x="${-w*p.x}" y="${-h*(1-p.y)}" width="${w}" height="${h}" preserveAspectRatio="none" opacity="${opacity}"/>`:'';
 const dynamic={m_CardBGImage:(s.cardBGList[c.elementIndex]||s.cardBGList[0]),m_CardFullBGImage:c.background,m_CardFullTransparentLayerBGImage:c.background,m_CenterFrameImage:c.art,m_CardFrontImage:(s.cardFrontImageList[c.elementIndex]||s.cardFrontImageList[0]),m_CardFrontImageTopLayer:(s.cardFrontImageList[c.elementIndex]||s.cardFrontImageList[0]),m_CardBorderImage:s.cardBorderImageList[c.border]||s.cardBorderImageList.at(-1),m_CardBorderMask:s.cardBorderMask,m_CenterFrameMaskImage:s.cardCenterFrameMask,m_StatImage:s.statImage,m_RarityImage:s.cardRarityImageList[c.rarityIndex],m_EvoPreviousStageIcon:c.previousArt};
 const positions={m_CardFrontImage:'cardFrontImage',m_CardFrontImageTopLayer:'cardFrontImage',m_CenterFrameMaskGrp:'centerFrameMask',m_CenterFrameImageGrp:'centerImageGrp',m_CardFullBGOffsetGrp:'centerImageGrp',m_CardFullBGTransparentLayeredOffsetGrp:'centerImageGrp',m_MonsterNameText:'name',m_NumberText:'number',m_FirstEditionText:'edition',m_StatGrp:'statGrp',m_EvoAndArtistNameGrp:'evoAndArtistNameGrp',m_EvoGrp:'evoGrp',m_DescriptionGrp:'descriptionGrp',m_ArtistGrp:'artistNameGrp',m_Stat1Text:'stat1',m_Stat2Text:'stat2',m_Stat3Text:'stat3',m_Stat4Text:'stat4'};
 const visibility={m_CardFrontImage:'showCardFront',m_CardFrontImageTopLayer:'showCardFrontTopLayer',m_CardBorderImage:'showBorder',m_CardFullBGImage:'showCardFullBG',m_CardFullTransparentLayerBGImage:'showCardFullLayeredBG',m_MonsterNameText:'showName',m_NumberText:'showNumber',m_FirstEditionText:'showEdition',m_RarityImage:'showRarity',m_Stat1Text:'showStat1',m_Stat2Text:'showStat2',m_Stat3Text:'showStat3',m_Stat4Text:'showStat4',m_EvoAndArtistNameGrp:'showEvoAndArtistNameGrp',m_FadeBarTopImage:'showFadeBarTop',m_FadeBarBtmImage:'showFadeBarBtm'};
 const texts={m_MonsterNameText:c.name,m_NumberText:String(c.number).padStart(3,'0'),m_FirstEditionText:c.border?(s.cardBorderNameList[c.border]||s.cardBorderNameList[0]):'',m_RarityText:c.rarity,m_DescriptionText:c.description,m_ArtistText:`Illus. ${c.artist}`,m_EvoPreviousStageNameText:c.previousName,m_Stat1Text:c.stats.FireElement,m_Stat2Text:c.stats.EarthElement,m_Stat3Text:c.stats.WaterElement,m_Stat4Text:c.stats.WindElement};
 function walk(id,pw=900,ph=900,pp={x:.5,y:.5}){
  const n=renderData.nodes[id],t=n.transform,k=n.text?.key||n.image?.key||n.key;
  if(['FoilGrp','CardBack','GradedCardTextureMask','CardBrightnessControl'].includes(n.name)||n.name.startsWith('CameraFoil')||n.name==='LegendaryShine')return '';
  if(visibility[k]&&!s[visibility[k]])return '';
  if(n.name==='EvoBasicIcon'&&c.previousEvolution||n.name==='EvoPreviousStageIcon'&&!c.previousEvolution||n.name==='EvoNameText'&&!c.previousEvolution)return '';
  const a=t.m_AnchorMin||{x:.5,y:.5},b=t.m_AnchorMax||a,p=t.m_Pivot||{x:.5,y:.5},d=t.m_SizeDelta||{x:900,y:900},ap=t.m_AnchoredPosition||{x:0,y:0};
  let w=pw*(b.x-a.x)+d.x,h=ph*(b.y-a.y)+d.y,x=pw*(a.x+(b.x-a.x)*p.x-pp.x)+ap.x,y=ph*(a.y+(b.y-a.y)*p.y-pp.y)+ap.y,sx=t.m_LocalScale?.x||1,sy=t.m_LocalScale?.y||1;
  const prefix=positions[k];if(prefix){const pos=s[prefix+'PosOffset'],scale=s[prefix+'ScaleOffset'];if(pos){x=pos.x;y=pos.y;}if(scale){sx=1+scale.x;sy=1+scale.y;}}
  let content='',mask='';
  if(n.image){const url=k in dynamic?dynamic[k]:n.image.sprite;const colors={m_EvoBGImage:s.evoBGColor,m_PlayEffectBGImage:s.playEffectBGColor,m_DescriptionBGImage:s.descriptionBGColor};
   if(n.mask){const mid=uid+'m'+id;defs.push(`<mask id="${mid}" maskUnits="userSpaceOnUse" x="${-w}" y="${-h}" width="${w*2}" height="${h*2}" style="mask-type:alpha">${img(url,w,h,p)}</mask>`);mask=` mask="url(#${mid})"`;if(n.showMask)content+=img(url,w,h,p);}
   else if(colors[k]){const co=colors[k];content+=`<rect x="${-w*p.x}" y="${-h*(1-p.y)}" width="${w}" height="${h}" fill="rgb(${co.r*255},${co.g*255},${co.b*255})" opacity="${co.a}"/>`;}
   else content+=img(url,w,h,p,n.image.color?.a??1);
  }
  if(n.text){const tx=n.text,v=k in texts?texts[k]:tx.value,align=tx.align===1?'left':tx.align===4?'right':'center';content+=`<foreignObject x="${-w*p.x}" y="${-h*(1-p.y)}" width="${w}" height="${Math.max(h,tx.fontSize*1.3)}"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Fredoka One,Arial,sans-serif;font-weight:${tx.fontStyle&1?700:400};font-style:${tx.fontStyle&2?'italic':'normal'};font-size:${tx.fontSize}px;line-height:1.08;color:white;text-align:${align};text-shadow:0 1px 2px #514c42,-1px 0 1px #514c42;overflow-wrap:break-word">${escape(v)}</div></foreignObject>`;}
  content+=n.children.map(ch=>walk(ch,w,h,p)).join('');
  return `<g transform="translate(${x},${-y}) scale(${sx},${sy})"><g${mask}>${content}</g></g>`;
 }
 const body=walk(renderData.root);return `<div class="card-visual reconstructed ${c.foil?'foil':''}"><svg viewBox="-285 -385 570 770" role="img" aria-label="${escape(c.name+' '+c.variant)}"><defs>${defs.join('')}</defs>${body}</svg>${c.foil?'<div class="foil-sheen"></div>':''}</div>`;
}

// Event delegation also covers artwork inside stacked card/variant dialogs.
document.addEventListener('pointermove',e=>{const card=e.target.closest?.('.reconstructed.foil');if(!card||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const r=card.getBoundingClientRect();card.style.setProperty('--foil-x',(25+50*(e.clientX-r.left)/r.width)+'%');card.style.setProperty('--foil-y',(25+50*(e.clientY-r.top)/r.height)+'%');});
