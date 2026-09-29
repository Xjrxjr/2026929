// 首页脚本 - 使用 GitHub 数据层
let brands = [], seriesList = [], models = [];

async function loadBrands() {
  brands = await GitHubData.getBrands();
  const sel = document.getElementById('filterBrand');
  sel.innerHTML = '<option value="">全部品牌</option>' + brands.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
}

async function loadSeries(brandId) {
  seriesList = await GitHubData.getSeries(brandId);
  const sel = document.getElementById('filterSeries');
  sel.innerHTML = '<option value="">全部车系</option>' + seriesList.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

async function loadModels(seriesId) {
  models = await GitHubData.getModels(seriesId);
  const sel = document.getElementById('filterModel');
  sel.innerHTML = '<option value="">全部车型</option>' + models.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
}

function onBrandChange() {
  const brandId = document.getElementById('filterBrand').value;
  document.getElementById('filterSeries').innerHTML = '<option value="">全部车系</option>';
  document.getElementById('filterModel').innerHTML = '<option value="">全部车型</option>';
  if (brandId) loadSeries(brandId);
  loadCars();
}

function onSeriesChange() {
  const seriesId = document.getElementById('filterSeries').value;
  document.getElementById('filterModel').innerHTML = '<option value="">全部车型</option>';
  if (seriesId) loadModels(seriesId);
  loadCars();
}

function resetFilters() {
  document.getElementById('keyword').value = '';
  document.getElementById('filterBrand').value = '';
  document.getElementById('filterSeries').innerHTML = '<option value="">全部车系</option>';
  document.getElementById('filterModel').innerHTML = '<option value="">全部车型</option>';
  loadCars();
}

async function loadCars() {
  const filters = {
    brand_id: document.getElementById('filterBrand').value,
    series_id: document.getElementById('filterSeries').value,
    model_id: document.getElementById('filterModel').value,
    keyword: document.getElementById('keyword').value
  };
  const cars = await GitHubData.getCars(filters);
  const grid = document.getElementById('carGrid');
  const empty = document.getElementById('emptyTip');
  if (cars.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  grid.innerHTML = cars.map(c => {
    const imgs = c.images ? c.images.split(',').filter(Boolean) : [];
    const img = imgs[0] || 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="280" height="180" fill="#eee"><rect width="280" height="180"/><text x="140" y="95" font-size="14" fill="#999" text-anchor="middle">暂无图片</text></svg>');
    return `<div class="car-card" onclick="showDetail(${c.id})">
      <img class="car-img" src="${img}" alt="${c.title}">
      <div class="car-info">
        <div class="car-title">${c.title}</div>
        <div class="car-price">${c.price}<small> 万</small></div>
        <div class="car-meta">
          ${c.year ? `<span>${c.year}年</span>` : ''}
          ${c.mileage ? `<span>${c.mileage}万公里</span>` : ''}
          ${c.fuel ? `<span>${c.fuel}</span>` : ''}
          ${c.transmission ? `<span>${c.transmission}</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

async function showDetail(id) {
  const c = await GitHubData.getCar(id);
  const imgs = c.images ? c.images.split(',').filter(Boolean) : [];
  const img = imgs[0] || '';
  const html = `
    <div class="detail-header">
      ${img ? `<img class="detail-img" src="${img}">` : '<div class="detail-img" style="display:flex;align-items:center;justify-content:center;color:#999;">暂无图片</div>'}
      <div>
        <div class="detail-title">${c.title}</div>
        <div class="detail-price">${c.price}<small> 万元</small></div>
        <div style="margin-top:10px;color:#666;">${c.brand_name} - ${c.series_name} - ${c.model_name}</div>
      </div>
    </div>
    ${imgs.length > 1 ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">${imgs.map(i => `<img src="${i}" style="width:100px;height:70px;object-fit:cover;border-radius:4px;">`).join('')}</div>` : ''}
    <div class="detail-specs">
      <div><strong>年份</strong>${c.year || '-'}</div>
      <div><strong>里程</strong>${c.mileage ? c.mileage + ' 万公里' : '-'}</div>
      <div><strong>颜色</strong>${c.color || '-'}</div>
      <div><strong>燃料</strong>${c.fuel || '-'}</div>
      <div><strong>变速箱</strong>${c.transmission || '-'}</div>
      <div><strong>发布时间</strong>${c.created_at ? c.created_at.slice(0,10) : '-'}</div>
    </div>
    ${c.description ? `<div style="margin-top:16px;"><h3 style="margin-bottom:8px;">车辆描述</h3><p style="color:#555;line-height:1.6;">${c.description}</p></div>` : ''}
    ${c.contact_name || c.contact_phone ? `<div class="detail-contact">
      <h3>联系方式</h3>
      <p>联系人：${c.contact_name || '-'}</p>
      <p>电话：${c.contact_phone || '-'}</p>
    </div>` : ''}
  `;
  document.getElementById('detailBody').innerHTML = html;
  document.getElementById('detailModal').classList.add('show');
}

function closeModal() {
  document.getElementById('detailModal').classList.remove('show');
}

// 搜索回车
document.getElementById('keyword').addEventListener('keypress', e => { if (e.key === 'Enter') loadCars(); });

// 初始化
loadBrands();
loadCars();
