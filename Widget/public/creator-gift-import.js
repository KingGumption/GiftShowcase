(function(){
  'use strict';
  const dialog=document.querySelector('#creator-gift-dialog');
  if(!dialog)return;
  const form=document.querySelector('#creator-gift-form'),message=document.querySelector('#creator-gift-message');
  const file=document.querySelector('#creator-gift-file'),preview=document.querySelector('#creator-gift-preview');
  const importButton=document.querySelector('#creator-gift-import');let pending=[],busy=false;
  function parseCSV(text) {
    const rows=[];let row=[],value='',quoted=false;
    text=text.replace(/^\uFEFF/,'');
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(c==='"'){
        if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;
      }else if(!quoted&&(c===','||c==='\n'||c==='\r')){
        row.push(value);value='';
        if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(v=>v.trim()))rows.push(row);row=[];}
      }else value+=c;
    }
    if(quoted)throw Error('CSV contains an unclosed quote');
    row.push(value);if(row.some(v=>v.trim()))rows.push(row);
    const headers=rows.shift()?.map(value=>value.trim().toLowerCase())||[];
    if(!['id','name','coins'].every(name=>headers.includes(name)))throw Error('CSV needs id, name and coins columns');
    return rows.map(values=>Object.fromEntries(headers.map((name,i)=>[name==='imageurl'?'imageUrl':name,values[i]?.trim()||''])));
  }
  function parseImport(text,json=false) {
    const data=json?JSON.parse(text):parseCSV(text);
    const rows=Array.isArray(data)?data:data.gifts||data.data?.gifts;
    if(!Array.isArray(rows)||!rows.length||rows.length>100)throw Error('Choose a file containing between 1 and 100 gifts');
    const ids=new Set();
    return rows.map((raw,i)=>{
      const gift={id:String(raw.id??raw.giftId??'').trim(),name:String(raw.name??raw.giftName??'').trim(),
        coins:raw.coins??raw.diamond_count??raw.diamondCount,
        imageUrl:String(raw.imageUrl||raw.giftPictureUrl||(typeof raw.image==='string'?raw.image:raw.image?.url_list?.[0])||'')};
      if(!/^[1-9]\d{0,19}$/.test(gift.id)||!gift.name||gift.name.length>160)throw Error('Row '+(i+1)+': enter a valid gift ID and name');
      if(gift.coins===undefined||gift.coins===null||String(gift.coins).trim()===''||!Number.isSafeInteger(Number(gift.coins))||Number(gift.coins)<0||Number(gift.coins)>10000000)throw Error('Row '+(i+1)+': enter a whole coin value');
      gift.coins=Number(gift.coins);
      if(ids.has(gift.id))throw Error('Duplicate gift ID '+gift.id);ids.add(gift.id);
      if(gift.imageUrl){let url;try{url=new URL(gift.imageUrl);}catch{throw Error('Row '+(i+1)+': invalid image URL');}
        if(url.protocol!=='https:'||url.username||url.password||url.port||!['tiktokcdn.com','tiktokcdn-eu.com','byteimg.com'].some(host=>url.hostname===host||url.hostname.endsWith('.'+host)))throw Error('Row '+(i+1)+': use a TikTok CDN image URL; upload other artwork separately');}
      return gift;
    });
  }
  // Exposed to the local regression harness and useful to other import surfaces.
  window.creatorGiftImport={parseCSV,parseImport};
  async function save(gifts) {
    if(busy)return;
    busy=true;document.querySelector('#creator-gift-save').disabled=true;importButton.disabled=true;
    message.textContent='Saving to your gift library…';
    try{
      const result=await window.overlayCloud.request('/v1/gifts/creator',{method:'POST',body:{gifts}});
      applyCreatorGifts(result.gifts);
      message.textContent=result.saved+' '+(result.saved===1?'gift saved.':'gifts saved.')+' Search by name, ID or coin value in the picker.';
      return true;
    }catch(error){message.textContent=error.message||'Import failed. Please try again.';return false;}
    finally{busy=false;document.querySelector('#creator-gift-save').disabled=false;importButton.disabled=!pending.length;}
  }
  document.querySelector('#creator-gift-open')?.addEventListener('click',()=>dialog.showModal());
  document.querySelector('#creator-gift-close').addEventListener('click',()=>{if(!busy)dialog.close();});
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    const gift=Object.fromEntries(new FormData(form));gift.coins=Number(gift.coins);
    const artwork=document.querySelector('#creator-gift-image').files[0];
    if(artwork){
      if(artwork.size>2*1024*1024){message.textContent='Choose artwork smaller than 2 MB.';return;}
      gift.imageUrl='';
      try{gift.imageData=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read artwork'));reader.readAsDataURL(artwork);});}
      catch(error){message.textContent=error.message;return;}
    }
    await save([gift]);
  });
  file.addEventListener('change',async()=>{
    pending=[];importButton.disabled=true;preview.textContent='';
    const chosen=file.files[0];if(!chosen)return;
    try{
      if(chosen.size>4000000)throw Error('Choose a CSV or JSON file smaller than 4 MB');
      const gifts=parseImport(await chosen.text(),/\.json$/i.test(chosen.name));
      const table=document.createElement('table');
      const header=table.createTHead().insertRow();
      for(const title of ['Gift','ID','Coins','Artwork']){const cell=document.createElement('th');cell.scope='col';cell.textContent=title;header.append(cell);}
      const body=table.createTBody();
      gifts.forEach(gift=>{const row=body.insertRow();for(const value of [gift.name,gift.id,gift.coins,gift.imageUrl?'TikTok image':'Keep existing / placeholder'])row.insertCell().textContent=String(value);});
      const note=document.createElement('p');note.textContent=gifts.length+' gifts ready. Matching IDs update your library; existing manual corrections take priority over live discovery.';
      preview.replaceChildren(note,table);pending=gifts;importButton.disabled=false;
    }catch(error){preview.textContent=error.message;}
  });
  importButton.addEventListener('click',async()=>{if(pending.length&&await save(pending)){pending=[];importButton.disabled=true;preview.textContent='Import complete.';file.value='';}});
  document.querySelector('#creator-gift-template').addEventListener('click',()=>{
    const url=URL.createObjectURL(new Blob(['id,name,coins,imageUrl\r\n123456,Example creator gift,100,\r\n'],{type:'text/csv'}));
    const link=document.createElement('a');link.href=url;link.download='creator-gifts-template.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
})();
