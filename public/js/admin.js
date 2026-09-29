// 管理后台脚本
let editingId = null;

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

// ===== 品牌管理 =====
async function loadBrandsAdmin() {
  const res = await fetch('/api/brands');
  const brands = await res.json();
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

  // 填充车系和车型的品牌下拉
  const opts = brands.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  document.getElementById('seriesBrandId').innerHTML = opts;
  document.getElementById('modelBrandId').innerHTML = opts;
  document.getElementById('carBrandId').innerHTML = opts;
}

async function saveBrand() {
  const name = document.getElementById('brandName').value.trim();
  const logo = document.getElementById('brandLogo').value.trim();
  if (!name) return alert('请输入品牌名称');
  await fetch('/api/brands', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ name, logo }) });
  document.getElementById('brandName').value = '';
  document.getElementById('brandLogo').value = '';
  loadBrandsAdmin();
}

async function updateBrand(id) {
  const name = document.getElementById('bn_' + id).value.trim();
  if (!name) return alert('名称不能为空');
  await fetch('/api/brands/' + id, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ name }) });
  loadBrandsAdmin();
}

async function deleteBrand(id) {
  if (!confirm('确定删除该品牌吗？相关车系和车型也会被删除！')) return;
  await fetch('/api/brands/' + id, { method: 'DELETE' });
  loadBrandsAdmin();
}

// ===== 车系管理 =====
async function loadSeriesAdmin() {
  const brandId = document.getElementById('seriesBrandId').value;
  const url = brandId ? `/api/series?brand_id=${brandId}` : '/api/series';
  const res = await fetch(url);
  const series = await res.json();
  const brands = await (await fetch('/api/brands')).json();
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
  await fetch('/api/series', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ brand_id, name }) });
  document.getElementById('seriesName').value = '';
  loadSeriesAdmin();
}

async function updateSeries(id) {
  const name = document.getElementById('sn_' + id).value.trim();
  if (!name) return alert('名称不能为空');
  await fetch('/api/series/' + id, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ name }) });
  loadSeriesAdmin();
}

async function deleteSeries(id) {
  if (!confirm('确定删除该车系吗？')) return;
  await fetch('/api/series/' + id, { method: 'DELETE' });
  loadSeriesAdmin();
}

// ===== 车型管理 =====
async function loadModelsAdmin() {
  const brandId = document.getElementById('modelBrandId').value;
  let url = '/api/models';
  if (brandId) {
    // 获取该品牌下所有车系，再获取车型
    const sRes = await fetch(`/api/series?brand_id=${brandId}`);
    const allSeries = await sRes.json();
    const allModels = [];
    for (const s of allSeries) {
      const mRes = await fetch(`/api/models?series_id=${s.id}`);
      const ms = await mRes.json();
      ms.forEach(m => { m.series_name = s.name; m.brand_id = brandId; });
      allModels.push(...ms);
    }
    renderModels(allModels);
  } else {
    const res = await fetch(url);
    const models = await res.json();
    // 获取品牌和车系名
    const brands = await (await fetch('/api/brands')).json();
    const allSeries = await (await fetch('/api/series')).json();
    const brandMap = Object.fromEntries(brands.map(b => [b.id, b.name]));
    const seriesMap = Object.fromEntries(allSeries.map(s => [s.id, s]));
    models.forEach(m => {
      const s = seriesMap[m.series_id];
      m.series_name = s ? s.name : '-';
      m.brand_name = s ? (brandMap[s.brand_id] || '-') : '-';
    });
    renderModels(models);
  }
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
  const res = await fetch(`/api/series?brand_id=${brandId}`);
  const series = await res.json();
  sel.innerHTML = series.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

async function saveModel() {
  const series_id = document.getElementById('modelSeriesId').value;
  const name = document.getElementById('modelName').value.trim();
  if (!series_id || !name) return alert('请选择车系并输入车型名称');
  await fetch('/api/models', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ series_id, name }) });
  document.getElementById('modelName').value = '';
  loadModelsAdmin();
}

async function updateModel(id) {
  const name = document.getElementById('mn_' + id).value.trim();
  if (!name) return alert('名称不能为空');
  await fetch('/api/models/' + id, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ name }) });
  loadModelsAdmin();
}

async function deleteModel(id) {
  if (!confirm('确定删除该车型吗？')) return;
  await fetch('/api/models/' + id, { method: 'DELETE' });
  loadModelsAdmin();
}

// ===== 车辆管理 =====
async function loadCarsAdmin() {
  const res = await fetch('/api/cars/all');
  const cars = await res.json();
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
  const res = await fetch(`/api/series?brand_id=${brandId}`);
  const series = await res.json();
  sel.innerHTML = series.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  loadModelsForCar();
}

async function loadModelsForCar() {
  const seriesId = document.getElementById('carSeriesId').value;
  const sel = document.getElementById('carModelId');
  if (!seriesId) { sel.innerHTML = ''; return; }
  const res = await fetch(`/api/models?series_id=${seriesId}`);
  const models = await res.json();
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
  const res = await fetch('/api/cars/' + id);
  const c = await res.json();
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

async function uploadImages() {
  const files = document.getElementById('carImageFiles').files;
  if (!files.length) return;
  const formData = new FormData();
  for (const f of files) formData.append('images', f);
  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  const data = await res.json();
  const existing = document.getElementById('carImages').value;
  document.getElementById('carImages').value = (existing ? existing + ',' : '') + data.urls.join(',');
  renderImagePreview();
  document.getElementById('carImageFiles').value = '';
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
  const url = editingId ? '/api/cars/' + editingId : '/api/cars';
  const method = editingId ? 'PUT' : 'POST';
  await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
  closeCarModal();
  loadCarsAdmin();
}

async function deleteCar(id) {
  if (!confirm('确定删除该车辆吗？')) return;
  await fetch('/api/cars/' + id, { method: 'DELETE' });
  loadCarsAdmin();
}

// 关闭弹窗（点击遮罩）
document.getElementById('carModal').onclick = e => { if (e.target.id === 'carModal') closeCarModal(); };

// 初始化
loadBrandsAdmin();
loadSeriesForModel();
loadCarsAdmin();
