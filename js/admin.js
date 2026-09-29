// 管理后台脚本 - 使用 GitHub 数据层
let editingId = null;

// ===== 登录验证 =====
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function checkLogin() {
  return sessionStorage.getItem('admin_logged_in') === '1';
}

async function doLogin() {
  const pwd = document.getElementById('loginPassword').value;
  const token = document.getElementById('githubToken').value.trim();
  const hash = await sha256(pwd);
  if (hash === window.ADMIN_PASSWORD_HASH) {
    sessionStorage.setItem('admin_logged_in', '1');
    if (token) {
      localStorage.setItem('github_token', token);
    }
    document.getElementById('loginOverlay').style.display = 'none';
    document.body.style.visibility = 'visible';
  } else {
    document.getElementById('loginError').style.display = 'block';
    document.getElementById('loginPassword').value = '';
  }
}

function initLogin() {
  if (checkLogin()) {
    document.getElementById('loginOverlay').style.display = 'none';
    document.body.style.visibility = 'visible';
  } else {
    document.body.style.visibility = 'hidden';
    document.getElementById('loginOverlay').style.display = 'flex';
  }
}

// 页面加载时先检查登录
initLogin();

// ===== 一键部署 =====
function showDeployTip(msg, type) {
  const old = document.querySelector('.deploy-tip');
  if (old) old.remove();
  const tip = document.createElement('div');
  tip.className = 'deploy-tip ' + (type || '');
  tip.innerHTML = `<span class="close-tip" onclick="this.parentElement.remove()">×</span>${msg}`;
  document.body.appendChild(tip);
  setTimeout(() => tip.remove(), 6000);
}

async function deploySite() {
  const btn = document.getElementById('deployBtn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '⏳ 部署中...';

  const { owner, repo } = window.GITHUB_CONFIG;
  const token = localStorage.getItem('github_token');

  try {
    // 1. 触发 GitHub Pages 重新构建
    if (token) {
      const buildRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pages/builds`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        },
        cache: 'no-store'
      });
      if (!buildRes.ok && buildRes.status !== 409) {
        throw new Error('触发构建失败: ' + buildRes.status);
      }
    }

    // 2. 清除数据缓存，重新加载
    GitHubData.refresh();
    await loadBrandsAdmin();
    await loadCarsAdmin();

    // 3. 刷新当前页面所有数据
    btn.classList.add('success');
    btn.innerHTML = '✅ 部署成功';
    showDeployTip('✅ 部署成功！数据已刷新，页面将在 1-2 分钟内更新到 GitHub Pages。<br><small>如首页未更新，请按 Ctrl+Shift+R 强制刷新。</small>', 'success');

    setTimeout(() => {
      btn.classList.remove('success');
      btn.innerHTML = originalText;
      btn.disabled = false;
    }, 3000);

  } catch (e) {
    btn.innerHTML = '❌ 部署失败';
    showDeployTip('❌ ' + e.message, 'error');
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }, 3000);
  }
}

// Tab 切换
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'series') loadSeriesAdmin();
    if (btn.dataset.tab === 'models') loadModelsAdmin();
    if (btn.dataset.tab === 'cars') loadCarsAdmin();
  };
});

// 通用错误处理
async function call(fn) {
  try { await fn(); }
  catch (e) { alert(e.message); }
}

// ===== 品牌管理 =====
async function loadBrandsAdmin() {
  const brands = await GitHubData.getBrands();
  document.getElementById('brandList').innerHTML = brands.map(b => `
    <tr>
      <td>${b.id}</td>
      <td><input type="text" value="${b.name}" id="bn_${b.id}" style="padding:4px 8px;border:1px solid #ddd;border-radius:3px;"></td>
      <td>${b.logo ? `<img src="${b.logo}" style="height:24px;">` : '-'}</td>
      <td>
        <button class="btn-edit" onclick="updateBrand(${b.id})">保存</button>
        <button class="btn-danger" onclick="deleteBrand(${b.id})">删除</button>
      </td>
    </tr>`).join('');

  const opts = brands.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  document.getElementById('seriesBrandId').innerHTML = opts;
  document.getElementById('modelBrandId').innerHTML = opts;
  document.getElementById('carBrandId').innerHTML = opts;
}

async function saveBrand() {
  const name = document.getElementById('brandName').value.trim();
  const logo = document.getElementById('brandLogo').value.trim();
  if (!name) return alert('请输入品牌名称');
  await call(() => GitHubData.addBrand(name, logo));
  document.getElementById('brandName').value = '';
  document.getElementById('brandLogo').value = '';
  loadBrandsAdmin();
}

async function updateBrand(id) {
  const name = document.getElementById('bn_' + id).value.trim();
  if (!name) return alert('名称不能为空');
  await call(() => GitHubData.updateBrand(id, name));
  loadBrandsAdmin();
}

async function deleteBrand(id) {
  if (!confirm('确定删除该品牌吗？相关车系和车型也会被删除！')) return;
  await call(() => GitHubData.deleteBrand(id));
  loadBrandsAdmin();
}

// ===== 车系管理 =====
async function loadSeriesAdmin() {
  const brandId = document.getElementById('seriesBrandId').value;
  const series = await GitHubData.getSeries(brandId);
  const brands = await GitHubData.getBrands();
  const brandMap = Object.fromEntries(brands.map(b => [b.id, b.name]));
  document.getElementById('seriesList').innerHTML = series.map(s => `
    <tr>
      <td>${s.id}</td>
      <td>${brandMap[s.brand_id] || '-'}</td>
      <td><input type="text" value="${s.name}" id="sn_${s.id}" style="padding:4px 8px;border:1px solid #ddd;border-radius:3px;"></td>
      <td>
        <button class="btn-edit" onclick="updateSeries(${s.id})">保存</button>
        <button class="btn-danger" onclick="deleteSeries(${s.id})">删除</button>
      </td>
    </tr>`).join('');
}

async function saveSeries() {
  const brand_id = document.getElementById('seriesBrandId').value;
  const name = document.getElementById('seriesName').value.trim();
  if (!brand_id || !name) return alert('请选择品牌并输入车系名称');
  await call(() => GitHubData.addSeries(brand_id, name));
  document.getElementById('seriesName').value = '';
  loadSeriesAdmin();
}

async function updateSeries(id) {
  const name = document.getElementById('sn_' + id).value.trim();
  if (!name) return alert('名称不能为空');
  await call(() => GitHubData.updateSeries(id, name));
  loadSeriesAdmin();
}

async function deleteSeries(id) {
  if (!confirm('确定删除该车系吗？')) return;
  await call(() => GitHubData.deleteSeries(id));
  loadSeriesAdmin();
}

// ===== 车型管理 =====
async function loadModelsAdmin() {
  const brandId = document.getElementById('modelBrandId').value;
  const brands = await GitHubData.getBrands();
  const allSeries = await GitHubData.getSeries();
  const allModels = await GitHubData.getModels();
  const brandMap = Object.fromEntries(brands.map(b => [b.id, b.name]));
  const seriesMap = Object.fromEntries(allSeries.map(s => [s.id, s]));

  let models = allModels;
  if (brandId) {
    const sids = allSeries.filter(s => s.brand_id == brandId).map(s => s.id);
    models = allModels.filter(m => sids.includes(m.series_id));
  }
  models.forEach(m => {
    const s = seriesMap[m.series_id];
    m.series_name = s ? s.name : '-';
    m.brand_name = s ? (brandMap[s.brand_id] || '-') : '-';
  });
  renderModels(models);
}

function renderModels(models) {
  document.getElementById('modelList').innerHTML = models.map(m => `
    <tr>
      <td>${m.id}</td>
      <td>${m.brand_name || '-'}</td>
      <td>${m.series_name || '-'}</td>
      <td><input type="text" value="${m.name}" id="mn_${m.id}" style="padding:4px 8px;border:1px solid #ddd;border-radius:3px;"></td>
      <td>
        <button class="btn-edit" onclick="updateModel(${m.id})">保存</button>
        <button class="btn-danger" onclick="deleteModel(${m.id})">删除</button>
      </td>
    </tr>`).join('');
}

async function loadSeriesForModel() {
  const brandId = document.getElementById('modelBrandId').value;
  const sel = document.getElementById('modelSeriesId');
  if (!brandId) { sel.innerHTML = '<option value="">请先选择品牌</option>'; return; }
  const series = await GitHubData.getSeries(brandId);
  sel.innerHTML = series.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

async function saveModel() {
  const series_id = document.getElementById('modelSeriesId').value;
  const name = document.getElementById('modelName').value.trim();
  if (!series_id || !name) return alert('请选择车系并输入车型名称');
  await call(() => GitHubData.addModel(series_id, name));
  document.getElementById('modelName').value = '';
  loadModelsAdmin();
}

async function updateModel(id) {
  const name = document.getElementById('mn_' + id).value.trim();
  if (!name) return alert('名称不能为空');
  await call(() => GitHubData.updateModel(id, name));
  loadModelsAdmin();
}

async function deleteModel(id) {
  if (!confirm('确定删除该车型吗？')) return;
  await call(() => GitHubData.deleteModel(id));
  loadModelsAdmin();
}

// ===== 车辆管理 =====
async function loadCarsAdmin() {
  const cars = await GitHubData.getAllCars();
  document.getElementById('carList').innerHTML = cars.map(c => `
    <tr>
      <td>${c.id}</td>
      <td>${c.title}</td>
      <td>${c.brand_name}</td>
      <td>${c.series_name}</td>
      <td>${c.model_name}</td>
      <td style="color:#e53935;font-weight:bold;">${c.price} 万</td>
      <td>${c.status ? '<span style="color:green;">上架</span>' : '<span style="color:#999;">下架</span>'}</td>
      <td>
        <button class="btn-edit" onclick="editCar(${c.id})">编辑</button>
        <button class="btn-danger" onclick="deleteCar(${c.id})">删除</button>
      </td>
    </tr>`).join('');
}

async function loadSeriesForCar() {
  const brandId = document.getElementById('carBrandId').value;
  const sel = document.getElementById('carSeriesId');
  if (!brandId) { sel.innerHTML = ''; return; }
  const series = await GitHubData.getSeries(brandId);
  sel.innerHTML = series.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  loadModelsForCar();
}

async function loadModelsForCar() {
  const seriesId = document.getElementById('carSeriesId').value;
  const sel = document.getElementById('carModelId');
  if (!seriesId) { sel.innerHTML = ''; return; }
  const models = await GitHubData.getModels(seriesId);
  sel.innerHTML = models.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
}

function openCarModal() {
  editingId = null;
  document.getElementById('carModalTitle').textContent = '添加车辆';
  document.getElementById('carTitle').value = '';
  document.getElementById('carPrice').value = '';
  document.getElementById('carYear').value = '';
  document.getElementById('carMileage').value = '';
  document.getElementById('carColor').value = '';
  document.getElementById('carFuel').value = '';
  document.getElementById('carTransmission').value = '';
  document.getElementById('carContactName').value = '';
  document.getElementById('carContactPhone').value = '';
  document.getElementById('carDescription').value = '';
  document.getElementById('carImages').value = '';
  document.getElementById('imagePreview').innerHTML = '';
  document.getElementById('carStatus').value = '1';
  document.getElementById('carModal').classList.add('show');
}

async function editCar(id) {
  const c = await GitHubData.getCar(id);
  editingId = id;
  document.getElementById('carModalTitle').textContent = '编辑车辆';
  document.getElementById('carBrandId').value = c.brand_id;
  await loadSeriesForCar();
  document.getElementById('carSeriesId').value = c.series_id;
  await loadModelsForCar();
  document.getElementById('carModelId').value = c.model_id;
  document.getElementById('carTitle').value = c.title;
  document.getElementById('carPrice').value = c.price;
  document.getElementById('carYear').value = c.year || '';
  document.getElementById('carMileage').value = c.mileage || '';
  document.getElementById('carColor').value = c.color || '';
  document.getElementById('carFuel').value = c.fuel || '';
  document.getElementById('carTransmission').value = c.transmission || '';
  document.getElementById('carContactName').value = c.contact_name || '';
  document.getElementById('carContactPhone').value = c.contact_phone || '';
  document.getElementById('carDescription').value = c.description || '';
  document.getElementById('carImages').value = c.images || '';
  document.getElementById('carStatus').value = c.status;
  renderImagePreview();
  document.getElementById('carModal').classList.add('show');
}

function closeCarModal() {
  document.getElementById('carModal').classList.remove('show');
}

function renderImagePreview() {
  const imgs = document.getElementById('carImages').value.split(',').filter(Boolean);
  document.getElementById('imagePreview').innerHTML = imgs.map((src, i) => `
    <div style="position:relative;">
      <img src="${src}">
      <span onclick="removeImage(${i})" style="position:absolute;top:-6px;right:-6px;background:#e53935;color:#fff;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;">×</span>
    </div>`).join('');
}

function removeImage(idx) {
  const imgs = document.getElementById('carImages').value.split(',').filter(Boolean);
  imgs.splice(idx, 1);
  document.getElementById('carImages').value = imgs.join(',');
  renderImagePreview();
}

// 通过 URL 添加图片
function addImageByUrl() {
  const input = document.getElementById('carImageUrl');
  const url = input.value.trim();
  if (!url) return;
  const existing = document.getElementById('carImages').value;
  document.getElementById('carImages').value = (existing ? existing + ',' : '') + url;
  input.value = '';
  renderImagePreview();
}

async function saveCar() {
  const data = {
    brand_id: document.getElementById('carBrandId').value,
    series_id: document.getElementById('carSeriesId').value,
    model_id: document.getElementById('carModelId').value,
    title: document.getElementById('carTitle').value.trim(),
    price: parseFloat(document.getElementById('carPrice').value),
    year: parseInt(document.getElementById('carYear').value) || null,
    mileage: parseFloat(document.getElementById('carMileage').value) || null,
    color: document.getElementById('carColor').value.trim(),
    fuel: document.getElementById('carFuel').value,
    transmission: document.getElementById('carTransmission').value,
    description: document.getElementById('carDescription').value.trim(),
    images: document.getElementById('carImages').value,
    contact_name: document.getElementById('carContactName').value.trim(),
    contact_phone: document.getElementById('carContactPhone').value.trim(),
    status: parseInt(document.getElementById('carStatus').value)
  };
  if (!data.brand_id || !data.series_id || !data.model_id || !data.title || !data.price) {
    return alert('请填写品牌、车系、车型、标题和价格');
  }
  await call(() => editingId ? GitHubData.updateCar(editingId, data) : GitHubData.addCar(data));
  closeCarModal();
  loadCarsAdmin();
}

async function deleteCar(id) {
  if (!confirm('确定删除该车辆吗？')) return;
  await call(() => GitHubData.deleteCar(id));
  loadCarsAdmin();
}

// 关闭弹窗（点击遮罩）
document.getElementById('carModal').onclick = e => { if (e.target.id === 'carModal') closeCarModal(); };

// 初始化
loadBrandsAdmin();
loadSeriesForModel();
loadCarsAdmin();
