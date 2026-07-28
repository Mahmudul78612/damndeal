(async function () {
  document.body.innerHTML = pageShell("Categories");
  buildLayout("categories");

  const content = document.getElementById("page-content");
  let categories = [], subCategories = [];
  let editId = null, editSubId = null;
  let activePlatform = "ddgo"; // "ddgo" or "damndeal"

  async function loadData() {
    try {
      const [catRes, subRes] = await Promise.all([
        API.get("/admin/categories?region=all"),
        API.get("/admin/subcategories"),
      ]);
      categories = catRes.categories || [];
      subCategories = subRes.subCategories || [];
      render();
    } catch (err) { showToast(err.message, "error"); }
  }

  function imgThumb(url) {
    if (!url) return '<span class="text-muted">—</span>';
    const src = url.startsWith("http") ? url : CONFIG.API_BASE.replace("/api", "") + url;
    return `<img src="${src}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">`;
  }

  function render() {
    const filteredCats = categories.filter(c => (c.platform || 'ddgo') === activePlatform);
    const filteredCatIds = new Set(filteredCats.map(c => c._id));
    const filteredSubs = subCategories.filter(s => {
      const catId = s.category?._id || s.category;
      return filteredCatIds.has(catId);
    });

    const ddgoActive = activePlatform === 'ddgo';
    const ddActive = activePlatform === 'damndeal';

    content.innerHTML = `
      <!-- Platform Tabs -->
      <div style="display:flex;gap:10px;margin-bottom:20px;">
        <button class="btn ${ddgoActive ? 'btn-primary' : 'btn-outline'}" style="${ddgoActive ? 'background:#0D7A30;border-color:#0D7A30;' : 'color:#0D7A30;border-color:#0D7A30;'}" onclick="switchPlatform('ddgo')">⚡ Quick Commerce</button>
        <button class="btn ${ddActive ? 'btn-primary' : 'btn-outline'}" style="${ddActive ? 'background:#7C3AED;border-color:#7C3AED;' : 'color:#7C3AED;border-color:#7C3AED;'}" onclick="switchPlatform('damndeal')">🛒 Online Store</button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <!-- Categories -->
        <div class="card">
          <div class="card-header">
            <h3>Categories</h3>
            <button class="btn btn-primary btn-sm" onclick="openCatModal()">+ Add</button>
          </div>
          <div class="card-body table-wrap">
            <table>
              <thead><tr><th>Image</th><th>Name</th><th>Slug</th><th>Regions</th><th>Order</th><th>Active</th><th>Actions</th></tr></thead>
              <tbody>
                ${filteredCats.map(c => {
                  const regs = Array.isArray(c.regions) && c.regions.length ? c.regions : ['IN'];
                  const badge = regs.map(r => `<span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;margin-right:4px;color:#fff;background:${r==='US'?'#0EA5E9':'#10B981'}">${r}</span>`).join('');
                  return `
                  <tr>
                    <td>${imgThumb(c.icon)}</td>
                    <td>${c.name}</td>
                    <td class="text-muted">${c.slug || '-'}</td>
                    <td>${badge}</td>
                    <td>${c.sortOrder ?? 0}</td>
                    <td>${c.isActive ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-gray">No</span>'}</td>
                    <td>
                      <button class="btn btn-outline btn-sm" onclick="editCat('${c._id}')">Edit</button>
                      <button class="btn btn-danger btn-sm" onclick="deleteCat('${c._id}')">Del</button>
                    </td>
                  </tr>`;
                }).join("") || `<tr><td colspan="7" class="text-center text-muted">No categories</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

        <!-- SubCategories -->
        <div class="card">
          <div class="card-header">
            <h3>Sub-Categories</h3>
            <button class="btn btn-primary btn-sm" onclick="openSubModal()">+ Add</button>
          </div>
          <div class="card-body table-wrap">
            <table>
              <thead><tr><th>Image</th><th>Name</th><th>Category</th><th>Actions</th></tr></thead>
              <tbody>
                ${filteredSubs.map(s => {
                  const parent = filteredCats.find(c => c._id === (s.category?._id || s.category));
                  return `<tr>
                    <td>${imgThumb(s.image)}</td>
                    <td>${s.name}</td>
                    <td class="text-muted">${parent?.name || s.category?.name || '-'}</td>
                    <td>
                      <button class="btn btn-outline btn-sm" onclick="editSub('${s._id}')">Edit</button>
                      <button class="btn btn-danger btn-sm" onclick="deleteSub('${s._id}')">Del</button>
                    </td>
                  </tr>`;
                }).join("") || `<tr><td colspan="4" class="text-center text-muted">No sub-categories</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Category Modal -->
      <div class="modal-overlay" id="cat-modal">
        <div class="modal">
          <div class="modal-header"><h3 id="cat-modal-title">Add Category</h3><button class="modal-close" onclick="closeModal('cat-modal')">&times;</button></div>
          <div class="modal-body">
            <div class="form-group"><label>Name</label><input class="form-control" id="cat-name"></div>
            <div class="form-group"><label>Sort Order</label><input class="form-control" type="number" id="cat-order" value="0"></div>
            <div class="form-group">
              <label>Regions (where this category appears)</label>
              <div style="display:flex;gap:14px;padding:8px 0">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="cat-region-IN" value="IN" checked> 🇮🇳 IN (damndeal.in)</label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="cat-region-US" value="US"> 🇺🇸 US (damndeal.com)</label>
              </div>
            </div>
            <div class="form-group">
              <label>Image</label>
              <div id="cat-img-preview" style="margin-bottom:8px;"></div>
              <input type="file" class="form-control" id="cat-image" accept="image/jpeg,image/png,image/webp" onchange="previewImg(this,'cat-img-preview')">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="closeModal('cat-modal')">Cancel</button>
            <button class="btn btn-primary" onclick="saveCat()">Save</button>
          </div>
        </div>
      </div>

      <!-- SubCategory Modal -->
      <div class="modal-overlay" id="sub-modal">
        <div class="modal">
          <div class="modal-header"><h3 id="sub-modal-title">Add Sub-Category</h3><button class="modal-close" onclick="closeModal('sub-modal')">&times;</button></div>
          <div class="modal-body">
            <div class="form-group"><label>Category</label>
              <select class="form-control" id="sub-cat">
                ${filteredCats.map(c => `<option value="${c._id}">${c.name}</option>`).join("")}
              </select>
            </div>
            <div class="form-group"><label>Name</label><input class="form-control" id="sub-name"></div>
            <div class="form-group">
              <label>Image</label>
              <div id="sub-img-preview" style="margin-bottom:8px;"></div>
              <input type="file" class="form-control" id="sub-image" accept="image/jpeg,image/png,image/webp" onchange="previewImg(this,'sub-img-preview')">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="closeModal('sub-modal')">Cancel</button>
            <button class="btn btn-primary" onclick="saveSub()">Save</button>
          </div>
        </div>
      </div>
    `;
  }

  window.switchPlatform = (p) => {
    activePlatform = p;
    render();
  };

  window.previewImg = (input, previewId) => {
    const container = document.getElementById(previewId);
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        container.innerHTML = `<img src="${e.target.result}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:2px solid #7c3aed;">`;
      };
      reader.readAsDataURL(input.files[0]);
    }
  };

  window.openCatModal = () => {
    editId = null;
    render();
    setTimeout(() => {
      document.getElementById("cat-modal-title").textContent = "Add Category";
      document.getElementById("cat-name").value = "";
      document.getElementById("cat-order").value = "0";
      document.getElementById("cat-image").value = "";
      document.getElementById("cat-img-preview").innerHTML = "";
      const cur = (localStorage.getItem('dd_region') || 'IN').toUpperCase();
      document.getElementById('cat-region-IN').checked = cur === 'IN';
      document.getElementById('cat-region-US').checked = cur === 'US';
      openModal("cat-modal");
    }, 0);
  };
  window.editCat = (id) => {
    editId = id;
    const c = categories.find(x => x._id === id);
    if (!c) return;
    render();
    setTimeout(() => {
      document.getElementById("cat-modal-title").textContent = "Edit Category";
      document.getElementById("cat-name").value = c.name;
      document.getElementById("cat-order").value = c.sortOrder || 0;
      document.getElementById("cat-image").value = "";
      const regs = Array.isArray(c.regions) && c.regions.length ? c.regions : ['IN'];
      document.getElementById('cat-region-IN').checked = regs.includes('IN');
      document.getElementById('cat-region-US').checked = regs.includes('US');
      const preview = document.getElementById("cat-img-preview");
      if (c.icon) {
        const src = c.icon.startsWith("http") ? c.icon : CONFIG.API_BASE.replace("/api", "") + c.icon;
        preview.innerHTML = `<img src="${src}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:2px solid #7c3aed;">`;
      } else {
        preview.innerHTML = "";
      }
      openModal("cat-modal");
    }, 0);
  };
  window.saveCat = async () => {
    const name = document.getElementById("cat-name").value.trim();
    const sortOrder = Number(document.getElementById("cat-order").value) || 0;
    const fileInput = document.getElementById("cat-image");
    if (!name) return showToast("Name required", "error");

    const regions = [];
    if (document.getElementById('cat-region-IN').checked) regions.push('IN');
    if (document.getElementById('cat-region-US').checked) regions.push('US');
    if (!regions.length) return showToast("Select at least one region", "error");

    const fd = new FormData();
    fd.append("name", name);
    fd.append("sortOrder", sortOrder);
    fd.append("platform", activePlatform);
    fd.append("regions", JSON.stringify(regions));
    if (fileInput.files[0]) fd.append("image", fileInput.files[0]);

    try {
      if (editId) await API.upload(`/admin/categories/${editId}`, fd, "PUT");
      else await API.upload("/admin/categories", fd);
      closeModal("cat-modal");
      showToast(editId ? "Updated" : "Created");
      loadData();
    } catch (err) { showToast(err.message, "error"); }
  };
  window.deleteCat = async (id) => {
    if (!confirm("Delete this category?")) return;
    try { await API.delete(`/admin/categories/${id}`); showToast("Deleted"); loadData(); }
    catch (err) { showToast(err.message, "error"); }
  };

  window.openSubModal = () => {
    editSubId = null;
    render();
    setTimeout(() => {
      document.getElementById("sub-modal-title").textContent = "Add Sub-Category";
      document.getElementById("sub-name").value = "";
      document.getElementById("sub-image").value = "";
      document.getElementById("sub-img-preview").innerHTML = "";
      openModal("sub-modal");
    }, 0);
  };
  window.editSub = (id) => {
    editSubId = id;
    const s = subCategories.find(x => x._id === id);
    if (!s) return;
    render();
    setTimeout(() => {
      document.getElementById("sub-modal-title").textContent = "Edit Sub-Category";
      document.getElementById("sub-name").value = s.name;
      document.getElementById("sub-cat").value = s.category?._id || s.category;
      document.getElementById("sub-image").value = "";
      const preview = document.getElementById("sub-img-preview");
      if (s.image) {
        const src = s.image.startsWith("http") ? s.image : CONFIG.API_BASE.replace("/api", "") + s.image;
        preview.innerHTML = `<img src="${src}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:2px solid #7c3aed;">`;
      } else {
        preview.innerHTML = "";
      }
      openModal("sub-modal");
    }, 0);
  };
  window.saveSub = async () => {
    const name = document.getElementById("sub-name").value.trim();
    const category = document.getElementById("sub-cat").value;
    const fileInput = document.getElementById("sub-image");
    if (!name || !category) return showToast("All fields required", "error");

    const fd = new FormData();
    fd.append("name", name);
    fd.append("category", category);
    if (fileInput.files[0]) fd.append("image", fileInput.files[0]);

    try {
      if (editSubId) await API.upload(`/admin/subcategories/${editSubId}`, fd, "PUT");
      else await API.upload("/admin/subcategories", fd);
      closeModal("sub-modal");
      showToast(editSubId ? "Updated" : "Created");
      loadData();
    } catch (err) { showToast(err.message, "error"); }
  };
  window.deleteSub = async (id) => {
    if (!confirm("Delete this sub-category?")) return;
    try { await API.delete(`/admin/subcategories/${id}`); showToast("Deleted"); loadData(); }
    catch (err) { showToast(err.message, "error"); }
  };

  loadData();
})();
