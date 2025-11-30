import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* 1. SUPABASE CONFIG
   Replace with your real project URL + anon key.
   Create:
   - table "portfolio"
   - table "requests"
   - storage bucket "portfolio"
*/

const SUPABASE_URL = "https://ntlaqnfoimkpcgguiamx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50bGFxbmZvaW1rcGNnZ3VpYW14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0NTUxNTEsImV4cCI6MjA4MDAzMTE1MX0.GOPs0fBRh27dKmNOC2XnwnqsaRK6NaKEymTbCf26G3c";
const BUCKET_NAME = "portfolio";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* 2. NAVIGATION BETWEEN SCREENS */

const navButtons = document.querySelectorAll(".nav-item");
const screens = {
  overview: document.getElementById("screen-overview"),
  portfolio: document.getElementById("screen-portfolio"),
  requests: document.getElementById("screen-requests"),
};

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.screen;
    navButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    Object.entries(screens).forEach(([name, el]) => {
      el.classList.toggle("screen-active", name === target);
    });
  });
});

/* 3. LOAD INITIAL DATA */

async function loadOverview() {
  // Total projects
  const { data: projects, error: pError } = await supabase
    .from("portfolio")
    .select("id,title,created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  if (pError) {
    console.error(pError);
  }

  const list = document.getElementById("overview-projects");
  const statProjects = document.querySelector("#stat-projects .stat-value");

  if (!projects || projects.length === 0) {
    list.innerHTML =
      '<p class="muted small">Projects you add in the Portfolio tab will appear here.</p>';
    list.classList.add("empty");
    statProjects.textContent = "0";
  } else {
    list.classList.remove("empty");
    statProjects.textContent = projects.length.toString();
    list.innerHTML = projects
      .map(
        (p) => `
      <div class="mini-item">
        <span>${escapeHtml(p.title)}</span>
        <span class="muted tiny">${new Date(p.created_at).toLocaleDateString()}</span>
      </div>`
      )
      .join("");
  }

  // Requests
  const { data: requests, error: rError } = await supabase
    .from("requests")
    .select("id, name, created_at, status")
    .order("created_at", { ascending: false })
    .limit(5);

  if (rError) {
    console.error(rError);
  }

  const listReq = document.getElementById("overview-requests");
  const statRequests = document.querySelector("#stat-requests .stat-value");
  const statOpen = document.querySelector("#stat-open .stat-value");

  if (!requests || requests.length === 0) {
    listReq.innerHTML =
      '<p class="muted small">When someone submits the form on the website, it will show up here.</p>';
    listReq.classList.add("empty");
    statRequests.textContent = "0";
    statOpen.textContent = "0";
  } else {
    listReq.classList.remove("empty");
    statRequests.textContent = requests.length.toString();
    const openCount = requests.filter(
      (r) => !r.status || r.status === "pending" || r.status === "in-progress"
    ).length;
    statOpen.textContent = openCount.toString();

    listReq.innerHTML = requests
      .map(
        (r) => `
      <div class="mini-item">
        <span>${escapeHtml(r.name)}</span>
        <span class="muted tiny">${new Date(r.created_at).toLocaleDateString()}</span>
      </div>`
      )
      .join("");
  }
}

/* 4. PORTFOLIO CRUD */

const projectForm = document.getElementById("projectForm");
const projectMsg = document.getElementById("projectMsg");
const projectsList = document.getElementById("projectsList");

if (projectForm) {
  projectForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    projectMsg.textContent = "Uploading…";
    const form = e.target;

    const title = form.title.value.trim();
    const video = form.video.value.trim();
    const file = form.thumb.files[0];

    if (!title || !video || !file) {
      projectMsg.textContent = "Please fill all fields.";
      return;
    }

    try {
      // upload file to storage
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(`graftmotion/${fileName}`, file);

      if (uploadError) {
        console.error(uploadError);
        projectMsg.textContent = "Failed to upload image.";
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET_NAME).getPublicUrl(uploadData.path);

      const { error: insertError } = await supabase.from("portfolio").insert({
        title,
        video,
        thumbnail: publicUrl,
      });

      if (insertError) {
        console.error(insertError);
        projectMsg.textContent = "Failed to save project.";
        return;
      }

      projectMsg.textContent = "Project saved.";
      form.reset();
      await loadProjects();
      await loadOverview();
    } catch (err) {
      console.error(err);
      projectMsg.textContent = "Something went wrong.";
    }
  });
}

async function loadProjects() {
  const { data, error } = await supabase
    .from("portfolio")
    .select("id,title,thumbnail,video,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    projectsList.innerHTML =
      '<p class="muted small">Could not load projects.</p>';
    return;
  }

  if (!data || data.length === 0) {
    projectsList.classList.add("empty");
    projectsList.innerHTML =
      '<p class="muted small">No projects yet. Add one using the form.</p>';
    return;
  }

  projectsList.classList.remove("empty");

  const rows = data
    .map(
      (p) => `
      <table class="table">
        <tbody>
          <tr>
            <td style="width:52px">
              ${
                p.thumbnail
                  ? `<img src="${p.thumbnail}" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:10px;">`
                  : ""
              }
            </td>
            <td>
              <div>${escapeHtml(p.title)}</div>
              <div class="muted tiny">${new Date(
                p.created_at
              ).toLocaleDateString()}</div>
            </td>
            <td class="actions">
              <button class="icon-btn" data-delete="${p.id}">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>`
    )
    .join("");

  projectsList.innerHTML = rows;

  // attach delete handlers
  projectsList.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.dataset.delete);
      if (!confirm("Delete this project?")) return;
      const { error: delError } = await supabase
        .from("portfolio")
        .delete()
        .eq("id", id);
      if (delError) {
        console.error(delError);
        alert("Failed to delete.");
        return;
      }
      await loadProjects();
      await loadOverview();
    });
  });
}

/* 5. REQUESTS TABLE */

const requestsTable = document.getElementById("requestsTable");
const statusFilter = document.getElementById("statusFilter");

async function loadRequests() {
  const { data, error } = await supabase
    .from("requests")
    .select("id,name,email,type,budget,details,status,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    requestsTable.innerHTML =
      '<p class="muted small">Could not load requests.</p>';
    return;
  }

  renderRequests(data || []);
}

function renderRequests(rows) {
  if (!rows || rows.length === 0) {
    requestsTable.classList.add("empty");
    requestsTable.innerHTML =
      '<p class="muted small">No requests yet.</p>';
    return;
  }

  requestsTable.classList.remove("empty");

  const filtered =
    statusFilter.value === "all"
      ? rows
      : rows.filter((r) => (r.status || "pending") === statusFilter.value);

  const html = `
    <table class="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Project</th>
          <th>Budget</th>
          <th>Status</th>
          <th>Date</th>
          <th class="actions">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${filtered
          .map(
            (r) => `
          <tr data-id="${r.id}">
            <td>${escapeHtml(r.name || "")}<br>
              <span class="muted tiny">${escapeHtml(r.email || "")}</span>
            </td>
            <td>${escapeHtml(r.type || "")}</td>
            <td>${escapeHtml(r.budget || "")}</td>
            <td>
              <span class="pill ${statusClass(r.status)}">
                ${statusLabel(r.status)}
              </span>
            </td>
            <td>${r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}</td>
            <td class="actions">
              <button class="icon-btn" data-status="pending">Pending</button>
              <button class="icon-btn" data-status="in-progress">In progress</button>
              <button class="icon-btn" data-status="done">Done</button>
            </td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;

  requestsTable.innerHTML = html;

  // attach status change handlers
  requestsTable
    .querySelectorAll("button[data-status]")
    .forEach((btn) => {
      btn.addEventListener("click", async () => {
        const tr = btn.closest("tr");
        const id = Number(tr.dataset.id);
        const status = btn.dataset.status;

        const { error } = await supabase
          .from("requests")
          .update({ status })
          .eq("id", id);

        if (error) {
          console.error(error);
          alert("Could not update status.");
          return;
        }
        await loadRequests();
        await loadOverview();
      });
    });
}

if (statusFilter) {
  statusFilter.addEventListener("change", loadRequests);
}

/* 6. HELPERS */

function statusLabel(status) {
  if (status === "in-progress") return "In progress";
  if (status === "done") return "Done";
  return "Pending";
}

function statusClass(status) {
  if (status === "in-progress") return "in-progress";
  if (status === "done") return "done";
  return "pending";
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (c) => {
    return (
      {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c] || c
    );
  });
}

/* 7. INITIAL LOAD */

(async function init() {
  await loadOverview();
  await loadProjects();
  await loadRequests();
})();
