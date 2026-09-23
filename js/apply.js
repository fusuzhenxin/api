(function () {
  const form = document.getElementById("applyForm");
  const note = document.getElementById("applyNote");
  const fail = document.getElementById("applyFail");
  const copy = document.getElementById("applyCopy");
  const send = document.getElementById("applySend");
  if (!form) return;

  function checked(name) {
    return Array.prototype.map
      .call(form.querySelectorAll('input[name="' + name + '"]:checked'), function (input) {
        return input.value;
      });
  }

  function payload() {
    return {
      name: form.name.value,
      url: form.url.value,
      api: form.api.value,
      kind: form.kind.value,
      models: checked("models"),
      features: checked("features"),
      applicant: form.applicant.value,
      email: form.email.value,
      contact: form.contact.value,
      intro: form.intro.value,
      company: form.company.value,
    };
  }

  function textOf(data) {
    const lines = [
      "站点名称：" + data.name,
      "网站地址：" + data.url,
      "接口地址：" + (data.api || "未填"),
      "类型：" + (data.kind === "charity" ? "公益站" : "付费中转"),
      "支持模型：" + (data.models.join("、") || "未填"),
      "特点：" + (data.features.join("、") || "未填"),
      "申请人：" + (data.applicant || "未填"),
      "联系邮箱：" + data.email,
      "其他联系方式：" + (data.contact || "未填"),
      "简介：" + data.intro,
    ];
    return lines.join("\n");
  }

  function showFail(data) {
    fail.hidden = false;
    copy.value = textOf(data);
    note.textContent = "没有发到邮箱。请把下面的内容发给站长。";
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const data = payload();
    fail.hidden = true;
    note.textContent = "正在发送…";
    send.disabled = true;
    fetch("/api/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data),
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { ok: res.ok, body: body };
        });
      })
      .then(function (result) {
        if (result.body && result.body.error) {
          note.textContent = result.body.error;
          return;
        }
        if (result.ok && result.body && result.body.ok) {
          note.textContent = "已经发到站长邮箱。收录前会打开你填的网址核对，不代表一定收录。";
          form.reset();
          return;
        }
        showFail(data);
      })
      .catch(function () {
        showFail(data);
      })
      .then(function () {
        send.disabled = false;
      });
  });

  document.getElementById("applyCopyBtn").addEventListener("click", function () {
    const text = copy.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          note.textContent = "申请内容已复制。";
        },
        function () {
          copy.focus();
          note.textContent = "请手动选中下面的文字复制。";
        }
      );
      return;
    }
    copy.focus();
    note.textContent = "请手动选中下面的文字复制。";
  });
})();
