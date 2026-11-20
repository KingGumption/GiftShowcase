(function initializeCloudAdmin(global) {
  'use strict';

  const cloud = global.overlayCloud;
  const editor = global.rewardConfigEditor;
  const localVersionsKey = 'reward-overlay-config-versions:v1';
  const panel = document.querySelector('#cloud-config-panel');
  const status = document.querySelector('#cloud-config-status');
  const disabledMessage = document.querySelector('#cloud-config-disabled');
  const authForm = document.querySelector('#cloud-auth-form');
  const authEmail = document.querySelector('#cloud-auth-email');
  const authPassword = document.querySelector('#cloud-auth-password');
  const authStatus = document.querySelector('#cloud-auth-status');
  const createAccount = document.querySelector('#cloud-create-account');
  const controls = document.querySelector('#cloud-variant-controls');
  const accountEmail = document.querySelector('#cloud-account-email');
  const accountSession = document.querySelector('#cloud-account-session');
  const signOut = document.querySelector('#cloud-sign-out');
  const exportAccount = document.querySelector('#cloud-export-account');
  const changeEmail = document.querySelector('#cloud-change-email');
  const clearLocalData = document.querySelector('#cloud-clear-local-data');
  const deleteAccount = document.querySelector('#cloud-delete-account');
  const registrationNote = document.querySelector('#cloud-registration-note');
  const variantKindLabel = document.querySelector('#cloud-variant-kind-label');
  const variantName = document.querySelector('#cloud-variant-name');
  const variantSelect = document.querySelector('#cloud-variant-select');
  const saveVariant = document.querySelector('#cloud-save-variant');
  const saveAsVariant = document.querySelector('#cloud-save-as-variant');
  const renameVariant = document.querySelector('#cloud-rename-variant');
  const deleteVariant = document.querySelector('#cloud-delete-variant');
  const versionMenu = document.querySelector('#cloud-version-menu');
  const variantDialog = document.querySelector('#cloud-variant-dialog');
  const variantDialogTitle = document.querySelector('#cloud-variant-dialog-title');
  const variantDialogDescription = document.querySelector('#cloud-variant-dialog-description');
  const variantDialogCancel = document.querySelector('#cloud-variant-dialog-cancel');
  const variantDialogConfirm = document.querySelector('#cloud-variant-dialog-confirm');
  const migrateVersions = document.querySelector('#cloud-migrate-versions');
  const liveUpdates = document.querySelector('#cloud-live-updates');
  const outputSelect = document.querySelector('#cloud-output-select');
  const outputKind = document.querySelector('#cloud-output-kind');
  const addToOutput = document.querySelector('#cloud-add-to-output');
  const overlayLabels = {
    carousel: 'Gift Carousel',
    rows: 'Rows Overlay',
    'side-gifts': 'Side Gifts',
    goal: sessionOverlay?.name || 'Goal Bar',
    'top-likers': 'Top Likers'
  };
  const overlayKinds = Object.keys(overlayLabels);

  let variants = [];
  let variantsReady = false;
  let docks = [];
  let activeOverlayKind = editor.getActiveOverlayKind?.() || 'carousel';
  let cloudBusy=false;const busyControls=new Set();
  const selectedVariantIds = new Map();
  let liveSaveTimer;
  let savingLive = false;
  let liveSavePending = false;
  let variantDialogMode = 'create';
  const dirtyOverlayKinds = new Set();
  const loadedRevisions=new Map();
  let deepLinkHandled=false;
  let accountEmailAvailable=false;
  let catalogRequested = false;
  let restoringSession = false;
  const retrySession=document.createElement('button');retrySession.type='button';retrySession.id='cloud-retry-session';retrySession.textContent='Retry connection';retrySession.hidden=true;status.after(retrySession);retrySession.onclick=()=>restoreSession();
  const editGenerations = new Map();
  const recovery=global.createStudioRecovery({editor,cloud,status:setCloudStatus,latest:id=>variants.find(item=>item.id===id),revision:()=>{const selected=getSelectedVariant();return selected?loadedRevisions.get(selected.id)??selected.revision:null;}});
  let sessionOwner='';
  let publishingAction=null;

  if (!panel || !cloud || !editor) return;

  if (!cloud.enabled) {
    document.body.classList.remove('cloud-authenticated');
    status.textContent = 'Cloud API not configured — editor access is locked';
    disabledMessage.hidden = false;
    const managerLink = panel.querySelector('.cloud-manager-link');
    if (managerLink) managerLink.hidden = true;
    return;
  }

  authForm.addEventListener('submit', event => {
    event.preventDefault();
    authenticate(authMode);
  });
  let authMode = 'login';
  createAccount.addEventListener('click', () => {
    authMode = authMode === 'login' ? 'register' : 'login';
    document.querySelector('#auth-mode-heading').textContent = authMode === 'register' ? 'Create your Studio account' : 'Sign in to your Studio';
    document.querySelector('#auth-password-help').hidden = authMode !== 'register';
    document.querySelector('#cloud-sign-in').textContent = authMode === 'register' ? 'Create account' : 'Sign in';
    createAccount.textContent = authMode === 'register' ? 'Already have an account? Sign in' : 'Create an account';
    authPassword.minLength=authMode==='register'?15:10;
    authPassword.autocomplete = authMode === 'register' ? 'new-password' : 'current-password';
    authEmail.focus();
  });
  const directButton = document.createElement('button');
  directButton.id = 'cloud-direct-link';
  directButton.type = 'button';
  directButton.textContent = 'Direct link';
  directButton.disabled = false;
  addToOutput.parentElement.append(directButton);
  const placement = document.createElement('p');
  placement.id = 'design-placement-status';
  placement.setAttribute('role', 'status');
  addToOutput.parentElement.after(placement);
  const linkDialog = document.querySelector('#direct-link-dialog');
  document.querySelector('#direct-link-close').onclick = () => linkDialog.close();
  document.querySelector('#direct-link-copy').onclick = async () => {
    const field = document.querySelector('#direct-link-url');
    try {
      await navigator.clipboard.writeText(field.value);
      document.querySelector('#direct-link-status').textContent = 'Link copied';
    } catch {
      field.select();
      document.querySelector('#direct-link-status').textContent = 'Select and copy the link above';
    }
  };
  let directLinkPending = false;
  let afterCanvasSave = null;
  variantDialog.addEventListener("close", () => { directLinkPending = false; afterCanvasSave = null; });
  directButton.onclick = async () => {
    let variant = getSelectedVariant();
    if (variant && dirtyOverlayKinds.has(activeOverlayKind)) {
      if (!confirm("Save your current edits before opening the direct link? This updates the design on stream.")) return;
      variant=await saveCurrentVariant(false);
      if (!variant || dirtyOverlayKinds.has(activeOverlayKind)) return;
    }
    if (!variant) {
      openVariantDialog('create');
      directLinkPending = true;
      variantDialogDescription.textContent = 'Name and save this design to create its permanent Direct link.';
      return;
    }
    directButton.disabled = true;
    try {
      const link = await cloud.getDirectLink(variant.id);
      document.querySelector('#direct-link-url').value = cloud.getWidgetUrl(link.publicToken);
      document.querySelector('#direct-link-size').textContent = 'Set the Browser Source to ' + link.width + ' × ' + link.height + ' pixels.';
      document.querySelector('#direct-link-status').textContent = '';
      linkDialog.showModal();
      document.querySelector("#direct-link-copy").focus();
    } catch (error) { setCloudStatus(error.message, true); }
    finally { directButton.disabled = false; }
  };
  global.createStudioRevisions({cloud,editor,selected:getSelectedVariant,status:setCloudStatus,dirty:()=>dirtyOverlayKinds.has(activeOverlayKind),flush:()=>recovery.flush(),restored:async variant=>{
    loadedRevisions.set(variant.id,variant.revision);
    await refreshVariants(variant.id);
    editor.loadConfigForKind(activeOverlayKind,variant.config,'Restored revision '+variant.revision);
    dirtyOverlayKinds.delete(activeOverlayKind);recovery.loaded();
    setCloudStatus('Restored as revision '+variant.revision+' · Direct link unchanged');renderPlacement();
  }});
  signOut.addEventListener('click', logout);
  exportAccount?.addEventListener('click', downloadAccountData);
  changeEmail?.addEventListener('click', changeAccountEmail);
  clearLocalData?.addEventListener('click', clearBrowserData);
  deleteAccount?.addEventListener('click', permanentlyDeleteAccount);
  saveVariant.addEventListener('click', saveSelectedVariant);
  saveAsVariant.addEventListener('click', () => openVariantDialog('create'));
  renameVariant.addEventListener('click', () => openVariantDialog('rename'));
  deleteVariant.addEventListener('click', deleteSelectedVariant);
  variantDialogCancel.addEventListener('click', () => variantDialog.close());
  variantDialog.querySelector('form').addEventListener('submit', confirmVariantDialog);
  migrateVersions.addEventListener('click', migrateLocalVersions);
  addToOutput.addEventListener('click', assignSelectedVariantToOutput);
  variantSelect.addEventListener('change', selectAndLoadVariant);
  global.addEventListener('rewardconfig:changed', () => {
    dirtyOverlayKinds.add(activeOverlayKind);
    editGenerations.set(activeOverlayKind,(editGenerations.get(activeOverlayKind)||0)+1);
    recovery.changed();renderPlacement();
    scheduleLiveSave();
  });
  global.addEventListener('rewardconfig:tabchanged', event => {
    const kind = event.detail?.tabName === 'original' ? 'carousel' : event.detail?.tabName;
    if (!overlayLabels[kind]) return;
    clearTimeout(liveSaveTimer);
    liveSavePending = false;
    if(variantsReady&&!recovery.restoring)selectedVariantIds.set(activeOverlayKind, variantSelect.value);
    recovery.switchKind(kind);
    activeOverlayKind = kind;
    setCloudStatus('');
    outputKind.value = kind;
    renderActiveOverlayKind();
    renderVariants(selectedVariantIds.get(kind) || '');
    renderPlacement();
  });
  global.addEventListener('overlaycloud:session', event=>renderSession(event.detail));

  outputKind.disabled = true;
  renderActiveOverlayKind();
  loadServiceConfig();
  restoreSession();

  function openEditorDeepLink(){
    if(deepLinkHandled)return;
    deepLinkHandled=true;
    const params=new URLSearchParams(location.search);
    if(sessionOverlay){
      const saved=variants.find(v=>v.id===(params.get('design')||selectedVariantIds.get('goal'))&&matchesStudioDesign(v));
      editor.setActiveKind('goal');
      if(saved) global.studioDesigns.open(saved.id);
      else global.studioDesigns.fresh('goal',{confirmed:true});
      global.studioSessionReady=true;
      global.dispatchEvent(new Event('studio:session-ready'));
      return;
    }
    if(Object.hasOwn(overlayLabels,params.get('kind'))) editor.setActiveKind(params.get('kind'));
    const id=new URLSearchParams(location.search).get('design');if(!id)return;
    const design=variants.find(item=>item.id===id);if(!design){setCloudStatus('This design is unavailable in your account.',true);return;}
    const definition=global.KGGraphics?.definition(design.overlayKind,design.config);
    if(definition?.live){
      const url=new URL(location.href);
      url.searchParams.set('overlay',definition.id);
      location.replace(url);
      return;
    }
    if(activeOverlayKind===design.overlayKind&&getSelectedVariant()?.id===id)return;
    editor.setActiveKind(design.overlayKind);variantSelect.value=id;selectAndLoadVariant();
  }
  function openSaveConflict(id){
    const dialog=studioDialog('A newer version exists','<p>Your local edits are safe. Another tab or device saved this design after you opened it.</p><div class="studio-dialog-actions"><button type="button" data-conflict-copy>Save my edits as a new design</button><button type="button" data-conflict-reload>Load the newest saved version</button><button type="button" data-conflict-replace>Replace the newest version</button></div><p role="status" data-conflict-status></p>');
    dialog.querySelector('[data-conflict-copy]').onclick=()=>{dialog.close();openVariantDialog('create');};
    dialog.querySelector('[data-conflict-reload]').onclick=async()=>{if(!confirm('Load the newest saved version? Your unsaved changes will be replaced.'))return;await refreshVariants(id);loadSelectedVariant();dialog.close();};
    dialog.querySelector('[data-conflict-replace]').onclick=async()=>{if(!confirm('Replace the newest saved version with your local edits? The previous save remains in version history.'))return;await refreshVariants(id);loadedRevisions.set(id,getSelectedVariant().revision);recovery.rebase(id,getSelectedVariant().revision);dialog.close();await saveCurrentVariant(false);};dialog.showModal();
  }
  global.studioDesigns={
    prepareCanvas(openPicker){
      if(getSelectedVariant()) { openPicker(); return; }
      openVariantDialog('create');
      afterCanvasSave=openPicker;
      variantDialogTitle.textContent='Save and add to canvas';
      variantDialogDescription.textContent='Name this design, then choose a canvas.';
      variantDialogConfirm.textContent='Save and continue';
    },
    all:()=>variants.map(item=>({...item})),selected:getSelectedVariant,status:setCloudStatus,refresh:refreshVariants,
    open(id){if(global.studioGuardOverlayChange?.(()=>global.studioDesigns.open(id)))return;const selected=variants.find(item=>item.id===id);if(!selected)return;recovery.flush();editor.setActiveKind(selected.overlayKind);variantSelect.value=id;selectAndLoadVariant();},
    async duplicate(id){const selected=variants.find(item=>item.id===id);if(!selected)return;const result=await cloud.createVariant({name:(selected.name+' copy').slice(0,80),overlayKind:selected.overlayKind,config:selected.config});await refreshVariants();return result.variant;},
    async archive(id,archived){await cloud.request('/v1/variants/'+encodeURIComponent(id)+'/archive',{method:'POST',body:{archived}});await refreshVariants();},
    async rename(id,name){const selected=variants.find(item=>item.id===id);const result=await cloud.updateVariant(id,{name,config:selected.config,overlayKind:selected.overlayKind,expectedRevision:selected.revision});loadedRevisions.set(id,result.variant.revision);recovery.rebase(id,result.variant.revision);await refreshVariants();},
    fresh(kind=activeOverlayKind,options={}){if(!options.confirmed&&global.studioGuardOverlayChange?.(()=>global.studioDesigns.fresh(kind,{confirmed:true})))return;global.studioDesigns.discard();editor.setActiveKind(kind);selectedVariantIds.set(kind,'');variantSelect.value='';editor.loadConfigForKind(kind,editor.getDefaults(kind),'New design');dirtyOverlayKinds.delete(kind);recovery.loaded();renderVariants('');renderPlacement();},
    async revert(){
      const current=getSelectedVariant(),kind=activeOverlayKind;if(!current)throw Error('Save this overlay design first.');
      if(savingLive||saveVariant.disabled)throw Error('A save is finishing. Try again once it completes.');
      clearTimeout(liveSaveTimer);liveSavePending=false;
      const result=await cloud.listVariants(),latest=result.variants?.find(item=>item.id===current.id);
      if(!latest)throw Error('The saved design is unavailable. Your unsaved changes are still open.');
      if(kind!==activeOverlayKind||getSelectedVariant()?.id!==current.id)throw Error('The selected design changed. Your unsaved changes are still open.');
      variants=result.variants;renderVariants(current.id);loadSelectedVariant();
      setCloudStatus('Reverted to saved revision '+latest.revision+'. Published designs and Direct links are unchanged.');
      global.dispatchEvent(new CustomEvent('studio:designloaded'));return latest;
    },
    discard(){clearTimeout(liveSaveTimer);liveSavePending=false;const selected=getSelectedVariant(),kind=activeOverlayKind;dirtyOverlayKinds.delete(kind);editor.loadConfigForKind(kind,selected?.config||editor.getDefaults(kind),'Changes discarded');recovery.loaded();renderPlacement();global.dispatchEvent(new CustomEvent('studio:designloaded'));},
    save:saveSelectedVariant,
    async rotate(){const selected=getSelectedVariant();if(!selected)return setCloudStatus('Save or choose a design first.',true);if(!confirm('Replace this design’s Direct link? The old link will stop working in your streaming software. Canvas links are unaffected.'))return;const password=await requestAccountPassword();if(!password)return;await cloud.request('/v1/variants/'+encodeURIComponent(selected.id)+'/rotate-link',{method:'POST',body:{password}});setCloudStatus('Direct link replaced. Copy the new link into your streaming software.');},
    state:()=>({kind:activeOverlayKind,busy:cloudBusy,dirty:dirtyOverlayKinds.has(activeOverlayKind),live:Boolean(liveUpdates.checked),placement:placement.textContent})
  };

  async function loadServiceConfig() {
    try {
      const serviceConfig = await cloud.getServiceConfig();
      createAccount.hidden = !serviceConfig.registrationEnabled;
      document.getElementById('studio-request-invitation').hidden=!serviceConfig.invitationRequestEnabled;
      accountEmailAvailable=Boolean(serviceConfig.accountRecoveryEnabled);
      if(changeEmail){changeEmail.disabled=!accountEmailAvailable;changeEmail.title=serviceConfig.accountRecoveryEnabled?'Confirm a new address by email':'Email changes need verified email delivery. Contact account support.';}
      if (registrationNote) {
        registrationNote.textContent = serviceConfig.registrationEnabled
          ? 'Read the privacy notice before creating an account.'
          : 'New account registration is currently invite-only.';
      }
    } catch {
      createAccount.hidden = true;
    }
  }

  async function restoreSession() {
    if(restoringSession)return;
    retrySession.hidden=true;
    if (!cloud.signedIn) {renderSession(null);return;}
    restoringSession=true;
    setBusy(true);
    // Reveal the cached account and local drafts before the network check.
    // The API still authorises every read and write; an expired token returns 401.
    renderSession(cloud.session);
    recovery.restore(selectedVariantIds,dirtyOverlayKinds,activeOverlayKind);
    setCloudStatus('Connecting to your saved designs…');
    try {
      const result = await cloud.me();
      renderSession({ ...cloud.session, user: result.user });
      await Promise.all([refreshVariants(), refreshDocks()]);
      for(const [kind,id] of selectedVariantIds){
        const saved=variants.find(item=>item.id===id);
        if(saved&&!dirtyOverlayKinds.has(kind)){
          const selection=editor.getSelection(kind);
          editor.loadConfigForKind(kind,saved.config,'Saved design loaded');
          if(kind===activeOverlayKind)editor.selectCard(selection);
          recovery.rebase(id,saved.revision);
        }
      }
      renderVariants(selectedVariantIds.get(activeOverlayKind)||'');
      openEditorDeepLink();
      if (!dirtyOverlayKinds.size) setCloudStatus('');
      else setCloudStatus('Recovered local edits. Save to publish them.');
    } catch (error) {
      if(!cloud.signedIn||error.status===401){
        renderSession(null);setAuthStatus('Your session has expired. Sign in again. Your unsaved changes have not been saved.',true);
      }else{
        renderSession(cloud.session);
        setCloudStatus('Cannot reach your saved designs. Your sign-in is kept. Unsaved edits remain open.',true);
        retrySession.disabled=false;
        retrySession.hidden=false;
      }
    } finally {restoringSession=false;if(variantsReady||!cloud.signedIn)setBusy(false);}
  }

  async function authenticate(mode) {
    const email = authEmail.value.trim();
    const password = authPassword.value;
    if (!email || (mode==='register'?[...password].length:password.length) < (mode==='register'?15:10)) {
      setAuthStatus('Enter an email and a password of at least '+(mode==='register'?15:10)+' characters.', true);
      return;
    }
    setAuthStatus('');
    setBusy(true);
    try {
      const result = mode === 'register'
        ? await cloud.register(email, password)
        : await cloud.login(email, password);
      authPassword.value = '';
      if (!result.session) {
        setAuthStatus(result.message || 'Try signing in with those details.', true);
        return;
      }
      renderSession(result.session);
      await Promise.all([refreshVariants(), refreshDocks()]);
      recovery.restore(selectedVariantIds,dirtyOverlayKinds,activeOverlayKind);
      renderVariants(selectedVariantIds.get(activeOverlayKind)||'');
      openEditorDeepLink();
      setCloudStatus(mode === 'register' ? 'Account created' : '');
    } catch (error) {
      setAuthStatus(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function logout(confirmed=false) {
    if(confirmed!==true&&global.studioHasUnsavedEdits?.()){global.studioRequestNavigation(()=>logout(true));return;}
    recovery.flush();
    setBusy(true);
    try {
      await cloud.logout();
      deepLinkHandled=false;global.studioSessionReady=false;
      recovery.resetOwner();selectedVariantIds.clear();editor.resetLocal();
      variants = [];
      docks = [];
      renderVariants();
      renderDocks();
      renderSession(null);
      setAuthStatus('You have signed out.');
    } catch (error) {
      setCloudStatus(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function downloadAccountData() {
    try {
      const data = await cloud.exportAccount();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `king-gumption-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setCloudStatus('Your account data has been downloaded');
    } catch (error) {
      setCloudStatus(error.message, true);
    }
  }


  function requestAccountPassword() {
    return new Promise(resolve => {
      const dialog = document.createElement('dialog');
      dialog.className = 'cloud-variant-dialog';
      dialog.innerHTML = '<form method="dialog"><h2>Confirm your password</h2><label>Current password<input name="password" type="password" autocomplete="current-password" required></label><div class="cloud-variant-dialog-actions"><button type="button" data-cancel>Cancel</button><button type="submit" value="confirm">Confirm</button></div></form>';
      document.body.append(dialog);
      dialog.querySelector('[data-cancel]').addEventListener('click', () => dialog.close());
      dialog.addEventListener('close', () => {
        const value = dialog.returnValue === 'confirm' ? dialog.querySelector('input').value : '';
        dialog.querySelector('input').value = '';
        dialog.remove();
        resolve(value);
      }, { once: true });
      dialog.showModal();
      dialog.querySelector('input').focus();
    });
  }

  async function changeAccountEmail() {
    const email = global.prompt('Enter the new email address');
    if (!email) return;
    const password = await requestAccountPassword();
    if (!password) return;
    try {
      const result = await cloud.updateAccountEmail(email, password);
      if(result.pending){setCloudStatus(result.message);return;}
      cloud.saveSession({ ...cloud.session, user: result.user });
      renderSession(cloud.session);
      setCloudStatus('Email address updated');
    } catch (error) {
      setCloudStatus(error.message, true);
    }
  }

  function clearBrowserData() {
    if (!global.confirm('Clear saved editor settings and local live-activity history from this browser? Saved designs will not be deleted.')) return;
    recovery.resetOwner();
    for(const key of Object.keys(localStorage))if(key.startsWith('kg-studio-drafts:'))localStorage.removeItem(key);
    editor.resetLocal();selectedVariantIds.clear();
    const removed = cloud.clearLocalOverlayData();
    setCloudStatus(`Cleared ${removed.length} locally stored item${removed.length === 1 ? '' : 's'}`);
  }

  async function permanentlyDeleteAccount() {
    if (!global.confirm('This permanently deletes your account, saved designs, revision history and output URLs. This cannot be undone.')) return;
    const confirmation = global.prompt('Type DELETE to confirm');
    if (confirmation !== 'DELETE') return;
    const password = await requestAccountPassword();
    if (!password) return;
    try {
      await cloud.deleteAccount(password, confirmation);
      variants = [];
      docks = [];
      renderVariants();
      renderDocks();
      renderSession(null);
      setCloudStatus('Account and cloud data permanently deleted');
    } catch (error) {
      setCloudStatus(error.message, true);
    }
  }

  function renderSession(session) {
    if (session && !catalogRequested) {
      catalogRequested = true;
      const script = document.createElement('script');
      script.src = './reward-image-catalog.js?v=20260802-1';
      script.onload = () => {
        if (typeof seedImageCatalog === 'function') seedImageCatalog();
        if (typeof loadGiftCatalogue === 'function') loadGiftCatalogue();
      };
      script.onerror = () => {
        catalogRequested = false;
        setCloudStatus('Gift catalogue could not load. Reload Studio to retry.', true);
      };
      document.head.append(script);
    }
    const signedIn = Boolean(session?.token && session?.user);
    if(signedIn && sessionOwner && sessionOwner!==session.user.id){deepLinkHandled=false;global.studioSessionReady=false;
      recovery.resetOwner();selectedVariantIds.clear();editor.resetLocal();}
    if(signedIn)sessionOwner=session.user.id;
    document.body.classList.toggle('cloud-authenticated', signedIn);
    authForm.hidden = signedIn;
    controls.hidden = !signedIn;
    if (accountSession) accountSession.hidden = !signedIn;
    signOut.hidden = !signedIn;
    accountEmail.textContent = session?.user?.email || '';
    if (signedIn) setAuthStatus('');
    if (!signedIn) status.textContent = 'Sign in to save variants and manage permanent outputs';
    status.hidden = signedIn && !status.textContent;
  }

  function setAuthStatus(message, isError = false) {
    if (!authStatus) return;
    authStatus.textContent = message;
    authStatus.hidden = !message;
    authStatus.classList.toggle('is-error', isError);
  }

  async function refreshVariants(selectedId = selectedVariantIds.get(activeOverlayKind) || variantSelect.value) {
    const result = await cloud.listVariants();
    variants = result.variants || [];
    variantsReady = true;
    variants.forEach(variant=>{if(!loadedRevisions.has(variant.id))loadedRevisions.set(variant.id,variant.revision);});
    renderVariants(selectedId);
  }

  function renderVariants(selectedId = '') {
    variantSelect.innerHTML = '<option value="">New design</option>';
    variants.filter(variant => variant.overlayKind === activeOverlayKind&&matchesStudioDesign(variant)&&(!variant.archived||variant.id===selectedId)).forEach(variant => {
      const option = document.createElement('option');
      option.value = variant.id;
      option.textContent = `${variant.name}`;
      variantSelect.append(option);
    });
    variantSelect.value = variants.some(variant => variant.id === selectedId && variant.overlayKind === activeOverlayKind) ? selectedId : '';
    const selected = getSelectedVariant();
    if(variantsReady&&!recovery.restoring)selectedVariantIds.set(activeOverlayKind, selected?.id || '');
    variantSelect.options[0].textContent = `New ${overlayLabels[activeOverlayKind]} design`;
    variantName.placeholder = `${overlayLabels[activeOverlayKind]} design name`;
    renameVariant.disabled = !selected;
    deleteVariant.disabled = !selected;
    directButton.disabled = false;
    renderPlacement();
  }

  function getSelectedVariant() {
    return variants.find(variant => variant.id === variantSelect.value && variant.overlayKind === activeOverlayKind) || null;
  }

  function renderActiveOverlayKind() {
    if (variantKindLabel) variantKindLabel.textContent = overlayLabels[activeOverlayKind];
    outputKind.value = activeOverlayKind;
    outputKind.title = `${overlayLabels[activeOverlayKind]} variants can only be added as this overlay type`;
  }

  async function refreshDocks() {
    const result = await cloud.listDocks();
    docks = result.docks || [];
    renderDocks();
  }

  function renderPlacement() {
    const variant = getSelectedVariant();
    if(sessionOverlay && global.studioSessionReady){
      const url=new URL(location.href);
      if(variant)url.searchParams.set('design',variant.id);else url.searchParams.delete('design');
      if(url.href!==location.href)history.replaceState(history.state,'',url);
    }
    const canvasAction=document.querySelector('[data-open-canvas-options]');
    if(canvasAction)canvasAction.textContent=variant?'Add to canvas':'Save and add to canvas';
    const outputs = variant ? docks.filter(d => d.items?.some(i => i.variantId === variant.id)) : [];
    directButton.textContent=variant&&dirtyOverlayKinds.has(activeOverlayKind)?'Save & direct link':'Direct link';
    addToOutput.textContent=variant&&dirtyOverlayKinds.has(activeOverlayKind)?'Save & add to canvas':'Add to canvas';
    placement.textContent = variant&&dirtyOverlayKinds.has(activeOverlayKind)?'Local draft · your stream is showing revision '+variant.revision+'. Save to publish your edits.' : !variant ? 'Save your design to get a Direct link or add it to a canvas.'
      : outputs.length ? 'On canvas in ' + outputs.map(d => d.name).join(', ') + '. You can also use its direct Direct link.'
      : 'Ready for your stream. Copy a direct link or choose a canvas and add this design.';
  }

  function renderDocks() {
    renderPlacement();
    if (!outputSelect) return;
    const selectedId = outputSelect.value;
    outputSelect.innerHTML = '<option value="">Choose a canvas</option>';
    docks.forEach(dock => {
      const option = document.createElement('option');
      option.value = dock.id;
      option.textContent = `${dock.name} (${dock.width} × ${dock.height})`;
      outputSelect.append(option);
    });
    outputSelect.value = docks.some(dock => dock.id === selectedId) ? selectedId : '';
  }

  async function assignSelectedVariantToOutput() {
    let variant = getSelectedVariant();
    if(variant && dirtyOverlayKinds.has(activeOverlayKind)) {
      if(!confirm('Save your edits and add this design to the canvas? This also updates any existing browser sources.'))return;
      variant=await saveCurrentVariant(false);
      if(!variant || dirtyOverlayKinds.has(activeOverlayKind))return;
    }
    if (!variant) {
      setCloudStatus('Save or choose a saved design first', true);
      return;
    }
    const dock = docks.find(item => item.id === outputSelect.value);
    if (!dock) {
      setCloudStatus('Choose a canvas first', true);
      return;
    }
    setBusy(true);
    try {
      await cloud.createDockItem(dock.id, { variantId: variant.id, overlayKind: activeOverlayKind });
      await refreshDocks();
      setCloudStatus(`Added ${variant.name} to ${dock.name}; arrange it in the Canvas Designer`);
    } catch (error) {
      setCloudStatus(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  function saveSelectedVariant() {
    if (getSelectedVariant()) {
      return saveCurrentVariant(false);
    }
    openVariantDialog('create');
  }

  function openVariantDialog(mode) {
    const selected = getSelectedVariant();
    versionMenu.open = false;
    if (mode === 'rename' && !selected) {
      setCloudStatus('Choose a saved design to rename', true);
      return;
    }
    variantDialogMode = mode;
    const isRename = mode === 'rename';
    variantDialogTitle.textContent = isRename ? 'Rename design' : 'Save a new design';
    variantDialogDescription.textContent = isRename
      ? 'Change the name without replacing your current editor settings.'
      : 'Give the current design a name so you can find it later.';
    variantDialogConfirm.textContent = isRename ? 'Rename' : 'Save';
    variantName.value = isRename ? selected.name : '';
    variantDialog.showModal();
    requestAnimationFrame(() => {
      variantName.focus();
      if (isRename) variantName.select();
    });
  }

  async function confirmVariantDialog(event) {
    event.preventDefault();
    const name = variantName.value.trim();
    if (!name) {
      setCloudStatus('Enter a design name first', true);
      variantName.focus();
      return;
    }
    const result = variantDialogMode === 'rename'
      ? await renameSelectedVariant(name)
      : await saveCurrentVariant(false, { forceCreate: true, nameOverride: name });
    if (result) {
      const openCanvas = afterCanvasSave;
      afterCanvasSave = null;
      const showLink = directLinkPending;
      directLinkPending = false;
      variantDialog.close();
      if (showLink) await directButton.onclick();
      else if (openCanvas) openCanvas();
    }
  }

  function selectAndLoadVariant(confirmed=false) {
    const previousId = selectedVariantIds.get(activeOverlayKind) || '';
    const nextId = variantSelect.value;
    const nextVariant = getSelectedVariant();
    recovery.flush();
    if (nextId !== previousId && dirtyOverlayKinds.has(activeOverlayKind)) {
      if(confirmed!==true){variantSelect.value=previousId;global.studioRequestNavigation(()=>{variantSelect.value=nextId;selectAndLoadVariant(true);});return;}
    }

    selectedVariantIds.set(activeOverlayKind, nextId);
    versionMenu.open = false;
    if (nextVariant) {
      if(!recovery.recoverSelection(activeOverlayKind,nextId))loadSelectedVariant();
      renderPlacement();
      return;
    }
    if(recovery.recoverSelection(activeOverlayKind,'')){renderPlacement();return;}
    dirtyOverlayKinds.add(activeOverlayKind);recovery.loaded();recovery.flush();
    setCloudStatus(`Current design can now be saved as a new ${overlayLabels[activeOverlayKind]} design`);
  }

  async function saveCurrentVariant(isLiveSave, options = {}) {
    if (savingLive) return null;
    const selected = options.forceCreate ? null : getSelectedVariant();
    const name = (options.nameOverride || selected?.name || '').trim();
    if (!name) {
      if (!isLiveSave) {
        openVariantDialog('create');
      }
      return null;
    }

    const saveKind=activeOverlayKind;
    const generation=editGenerations.get(saveKind)||0;
    const saveConfig=editor.getConfigForKind(saveKind);
    if(sessionOverlay && saveKind==='goal'){
      const rules=saveConfig.goalBar.graphic;
      if(rules?.variant!==sessionOverlay.id || (rules.variant==='vote' && (!rules.aGift || !rules.bGift || rules.aGift===rules.bGift))){
        setCloudStatus('Choose two different gifts for voting before saving.',true);return null;
      }
    }
    savingLive = true;
    if (!isLiveSave) setBusy(true);
    try {
      const result = selected
        ? await cloud.updateVariant(selected.id, { name, overlayKind: saveKind, config: saveConfig, expectedRevision:recovery.baseRevision(selected.id)??loadedRevisions.get(selected.id)??selected.revision })
        : await cloud.createVariant({ name, overlayKind: saveKind, config: saveConfig });
      loadedRevisions.set(result.variant.id,result.variant.revision);
      if(saveKind===activeOverlayKind)await refreshVariants(result.variant.id);else {selectedVariantIds.set(saveKind,result.variant.id);await refreshVariants();}
      if((editGenerations.get(saveKind)||0)===generation)dirtyOverlayKinds.delete(saveKind);
      recovery.saved(saveKind,result.variant.id,saveConfig);renderPlacement();
      setCloudStatus(`${isLiveSave ? 'Live updated' : 'Saved'} ${result.variant.name} — revision ${result.variant.revision}`);
      editor.setState(dirtyOverlayKinds.has(saveKind)?'Unsaved changes made during save':`${isLiveSave ? 'Live updated' : 'Saved to cloud'}: ${result.variant.name}`);
      return result.variant;
    } catch (error) {
      setCloudStatus(error.message, true);
      if(error.status===409&&selected)setTimeout(()=>openSaveConflict(selected.id),0);
      return null;
    } finally {
      savingLive = false;
      if (!isLiveSave) setBusy(false);
      if (liveSavePending) {
        liveSavePending = false;
        scheduleLiveSave();
      }
    }
  }

  function loadSelectedVariant() {
    const selected = getSelectedVariant();
    if (!selected) {
      setCloudStatus('Choose a saved design first', true);
      return;
    }
    loadedRevisions.set(selected.id,selected.revision);
    editor.loadConfigForKind(activeOverlayKind, selected.config, `Loaded ${overlayLabels[activeOverlayKind]} variant: ${selected.name}`);
    dirtyOverlayKinds.delete(activeOverlayKind);
    recovery.loaded();renderPlacement();
    setCloudStatus(`Loaded ${selected.name} — revision ${selected.revision}`);
  }

  async function renameSelectedVariant(name) {
    const selected = getSelectedVariant();
    if (!selected) {
      setCloudStatus('Choose a saved design to rename', true);
      return null;
    }
    setBusy(true);
    try {
      const result = await cloud.updateVariant(selected.id, {
        name,
        overlayKind: activeOverlayKind,
        expectedRevision:loadedRevisions.get(selected.id)??selected.revision,
        config: selected.config
      });
      await refreshVariants(result.variant.id);
      loadedRevisions.set(result.variant.id,result.variant.revision);recovery.rebase(result.variant.id,result.variant.revision);
      setCloudStatus(`Renamed version to ${result.variant.name}`);
      return result.variant;
    } catch (error) {
      setCloudStatus(error.message, true);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelectedVariant() {
    versionMenu.open = false;
    const selected = getSelectedVariant();
    if (!selected) {
      setCloudStatus('Choose a saved design first', true);
      return;
    }
    if (!confirm(`Delete saved design "${selected.name}" and its revision history?`)) return;
    setBusy(true);
    try {
      await cloud.deleteVariant(selected.id);
      dirtyOverlayKinds.delete(activeOverlayKind);
      await refreshVariants('');
      setCloudStatus(`Deleted ${selected.name}`);
    } catch (error) {
      setCloudStatus(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function migrateLocalVersions() {
    let localVersions;
    try {
      localVersions = JSON.parse(localStorage.getItem(localVersionsKey) || '[]');
    } catch {
      localVersions = [];
    }
    if (!Array.isArray(localVersions) || !localVersions.length) {
      setCloudStatus('No named local versions were found', true);
      return;
    }

    setBusy(true);
    let imported = 0;
    let skipped = 0;
    try {
      const existingNames = new Set(variants.map(variant => `${variant.overlayKind}:${normalizeName(variant.name)}`));
      for (const localVersion of localVersions) {
        if (!localVersion?.name || !localVersion?.config) {
          skipped += 1;
          continue;
        }
        for (const overlayKind of overlayKinds) {
          const key = `${overlayKind}:${normalizeName(localVersion.name)}`;
          if (existingNames.has(key)) {
            skipped += 1;
            continue;
          }
          const result = await cloud.createVariant({
            name: localVersion.name,
            overlayKind,
            config: editor.getConfigForKind(overlayKind, localVersion.config)
          });
          existingNames.add(`${overlayKind}:${normalizeName(result.variant.name)}`);
          imported += 1;
        }
      }
      await refreshVariants();
      setCloudStatus(`Migrated ${imported} local version${imported === 1 ? '' : 's'}${skipped ? `; skipped ${skipped} duplicate/invalid` : ''}`);
    } catch (error) {
      setCloudStatus(`Migration stopped: ${error.message}`, true);
    } finally {
      setBusy(false);
    }
  }

  function scheduleLiveSave() {
    clearTimeout(liveSaveTimer);
    if (!liveUpdates.checked || !getSelectedVariant()) return;
    if (savingLive) {
      liveSavePending = true;
      return;
    }
    liveSaveTimer = setTimeout(() => saveCurrentVariant(true), 450);
  }

  function setBusy(busy) {
    cloudBusy=busy;
    if(busy)panel.querySelectorAll('button, input, select').forEach(element=>{busyControls.add(element);if(!element.hasAttribute('data-busy-disabled'))element.dataset.busyDisabled=String(element.disabled);element.disabled=true;});
    else {for(const element of busyControls){element.disabled=element.dataset.busyDisabled==='true';delete element.dataset.busyDisabled;}busyControls.clear();}
    global.dispatchEvent(new CustomEvent('studio:busy'));
    outputKind.disabled = true;
    if (!busy) {
      const hasSelectedVariant = Boolean(getSelectedVariant());
      if(changeEmail)changeEmail.disabled=!accountEmailAvailable;
      renameVariant.disabled = !hasSelectedVariant;
      deleteVariant.disabled = !hasSelectedVariant;
    }
  }

  function setCloudStatus(message, isError = false) {
    status.textContent = message;
    status.hidden = !message;
    status.classList.toggle('is-error', isError);
  }

  function normalizeName(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }
})(window);
