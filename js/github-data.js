// GitHub 数据层 - 通过 GitHub Contents API 读写仓库中的 data.json
const GitHubData = (() => {
  const { owner, repo } = window.GITHUB_CONFIG;
  const DATA_PATH = 'data.json';
  const API_BASE = `https://api.github.com/repos/${owner}/${repo}/contents/${DATA_PATH}`;

  let cache = null;
  let currentSha = null;

  // 获取写操作的 headers（token 从 localStorage 读取）
  function getWriteHeaders() {
    const token = localStorage.getItem('github_token') || '';
    return {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
  }

  // 从 GitHub 读取数据（用 raw 链接，公开仓库无需 token）
  async function load() {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${DATA_PATH}`;
    const res = await fetch(rawUrl, { cache: 'no-store' });
    if (res.status === 404) {
      cache = { brands: [], series: [], models: [], cars: [], nextId: { brands: 1, series: 1, models: 1, cars: 1 } };
      currentSha = null;
      return cache;
    }
    if (!res.ok) throw new Error('读取数据失败: ' + res.status);
    cache = await res.json();
    currentSha = null; // save 时重新获取
    return cache;
  }

  // 写入数据到 GitHub（带 SHA 重试）
  async function save() {
    const token = localStorage.getItem('github_token');
    if (!token) throw new Error('请先在管理后台设置 GitHub Token');

    const content = btoa(unescape(encodeURIComponent(JSON.stringify(cache, null, 2))));

    // 最多重试 3 次（处理 SHA 不匹配）
    for (let attempt = 0; attempt < 3; attempt++) {
      // 重新获取当前文件的 sha
      const getRes = await fetch(API_BASE, {
        headers: getWriteHeaders(),
        cache: 'no-store'
      });
      if (getRes.ok) {
        const getJson = await getRes.json();
        currentSha = getJson.sha;
      } else if (getRes.status !== 404) {
        throw new Error('获取文件信息失败: ' + getRes.status);
      }

      const body = {
        message: 'update data.json',
        content: content
      };
      if (currentSha) body.sha = currentSha;

      const res = await fetch(API_BASE, {
        method: 'PUT',
        headers: getWriteHeaders(),
        body: JSON.stringify(body),
        cache: 'no-store'
      });

      if (res.ok) {
        const result = await res.json();
        currentSha = result.content.sha;
        return result;
      }

      // 如果是 SHA 不匹配（409），重试
      if (res.status === 409 && attempt < 2) {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      const err = await res.json().catch(() => ({}));
      throw new Error('保存失败: ' + (err.message || res.status));
    }
  }

  // 获取数据（带缓存）
  async function getData() {
    if (!cache) await load();
    return cache;
  }

  // 获取并保存（封装写操作）
  async function mutate(fn) {
    if (!cache) await load();
    fn(cache);
    await save();
    return cache;
  }

  // ========== 品牌 ==========
  async function getBrands() {
    const d = await getData();
    return d.brands.slice().sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  }

  async function addBrand(name, logo) {
    return mutate(d => {
      if (d.brands.some(b => b.name === name)) throw new Error('品牌已存在');
      const b = { id: d.nextId.brands++, name, logo: logo || '' };
      d.brands.push(b);
    });
  }

  async function updateBrand(id, name, logo) {
    return mutate(d => {
      const b = d.brands.find(x => x.id == id);
      if (!b) throw new Error('品牌不存在');
      b.name = name;
      b.logo = logo || '';
    });
  }

  async function deleteBrand(id) {
    return mutate(d => {
      const idx = d.brands.findIndex(b => b.id == id);
      if (idx === -1) throw new Error('品牌不存在');
      d.brands.splice(idx, 1);
      const sids = d.series.filter(s => s.brand_id == id).map(s => s.id);
      d.series = d.series.filter(s => s.brand_id != id);
      d.models = d.models.filter(m => !sids.includes(m.series_id));
      d.cars = d.cars.filter(c => c.brand_id != id);
    });
  }

  // ========== 车系 ==========
  async function getSeries(brandId) {
    const d = await getData();
    let s = d.series;
    if (brandId) s = s.filter(x => x.brand_id == brandId);
    return s.slice().sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  }

  async function addSeries(brand_id, name) {
    return mutate(d => {
      const s = { id: d.nextId.series++, brand_id: Number(brand_id), name };
      d.series.push(s);
    });
  }

  async function updateSeries(id, name) {
    return mutate(d => {
      const s = d.series.find(x => x.id == id);
      if (!s) throw new Error('车系不存在');
      s.name = name;
    });
  }

  async function deleteSeries(id) {
    return mutate(d => {
      const idx = d.series.findIndex(s => s.id == id);
      if (idx === -1) throw new Error('车系不存在');
      d.series.splice(idx, 1);
      d.models = d.models.filter(m => m.series_id != id);
      d.cars = d.cars.filter(c => c.series_id != id);
    });
  }

  // ========== 车型 ==========
  async function getModels(seriesId) {
    const d = await getData();
    let m = d.models;
    if (seriesId) m = m.filter(x => x.series_id == seriesId);
    return m.slice().sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  }

  async function addModel(series_id, name) {
    return mutate(d => {
      const m = { id: d.nextId.models++, series_id: Number(series_id), name };
      d.models.push(m);
    });
  }

  async function updateModel(id, name) {
    return mutate(d => {
      const m = d.models.find(x => x.id == id);
      if (!m) throw new Error('车型不存在');
      m.name = name;
    });
  }

  async function deleteModel(id) {
    return mutate(d => {
      const idx = d.models.findIndex(m => m.id == id);
      if (idx === -1) throw new Error('车型不存在');
      d.models.splice(idx, 1);
      d.cars = d.cars.filter(c => c.model_id != id);
    });
  }

  // ========== 车辆 ==========
  function enrich(c, d) {
    const brand = d.brands.find(b => b.id === c.brand_id);
    const series = d.series.find(s => s.id === c.series_id);
    const model = d.models.find(m => m.id === c.model_id);
    return { ...c, brand_name: brand ? brand.name : '', series_name: series ? series.name : '', model_name: model ? model.name : '' };
  }

  async function getCars(filters = {}) {
    const d = await getData();
    let cars = d.cars.filter(c => c.status === 1);
    if (filters.brand_id) cars = cars.filter(c => c.brand_id == filters.brand_id);
    if (filters.series_id) cars = cars.filter(c => c.series_id == filters.series_id);
    if (filters.model_id) cars = cars.filter(c => c.model_id == filters.model_id);
    if (filters.keyword) {
      const kw = filters.keyword;
      cars = cars.filter(c => c.title.includes(kw) || (c.description && c.description.includes(kw)));
    }
    cars.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return cars.map(c => enrich(c, d));
  }

  async function getAllCars() {
    const d = await getData();
    const cars = d.cars.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return cars.map(c => enrich(c, d));
  }

  async function getCar(id) {
    const d = await getData();
    const c = d.cars.find(x => x.id == id);
    if (!c) throw new Error('车辆不存在');
    return enrich(c, d);
  }

  async function addCar(data) {
    return mutate(d => {
      const car = {
        id: d.nextId.cars++,
        brand_id: Number(data.brand_id),
        series_id: Number(data.series_id),
        model_id: Number(data.model_id),
        title: data.title,
        price: Number(data.price),
        year: data.year || null,
        mileage: data.mileage || null,
        color: data.color || '',
        fuel: data.fuel || '',
        transmission: data.transmission || '',
        description: data.description || '',
        images: data.images || '',
        contact_name: data.contact_name || '',
        contact_phone: data.contact_phone || '',
        status: 1,
        created_at: new Date().toISOString()
      };
      d.cars.push(car);
    });
  }

  async function updateCar(id, data) {
    return mutate(d => {
      const car = d.cars.find(c => c.id == id);
      if (!car) throw new Error('车辆不存在');
      Object.assign(car, {
        brand_id: Number(data.brand_id),
        series_id: Number(data.series_id),
        model_id: Number(data.model_id),
        title: data.title,
        price: Number(data.price),
        year: data.year || null,
        mileage: data.mileage || null,
        color: data.color || '',
        fuel: data.fuel || '',
        transmission: data.transmission || '',
        description: data.description || '',
        images: data.images || '',
        contact_name: data.contact_name || '',
        contact_phone: data.contact_phone || '',
        status: data.status ?? 1
      });
    });
  }

  async function deleteCar(id) {
    return mutate(d => {
      const idx = d.cars.findIndex(c => c.id == id);
      if (idx === -1) throw new Error('车辆不存在');
      d.cars.splice(idx, 1);
    });
  }

  // 刷新缓存
  function refresh() {
    cache = null;
    currentSha = null;
  }

  return {
    load, refresh,
    getBrands, addBrand, updateBrand, deleteBrand,
    getSeries, addSeries, updateSeries, deleteSeries,
    getModels, addModel, updateModel, deleteModel,
    getCars, getAllCars, getCar, addCar, updateCar, deleteCar
  };
})();
