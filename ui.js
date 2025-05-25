import { loadResults } from "./storage.js";

export function showScoresPopover() {
  const gameData = loadResults();
  const gameResults = Object.entries(gameData)
    .filter(([key]) => key !== "targets" && !isNaN(Date.parse(key)))
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
    .slice(0, 5)
    .map(([timestamp, data]) => ({
      timestamp,
      averageTime: data.averageTime,
      incorrectClicks: data.incorrectClicks,
      missedGreenTargets: data.missedGreenTargets,
      targets: data.targets,
      score: data.score,
    }));

  let popover = document.getElementById("scores-popover");
  if (!popover) {
    popover = document.createElement("div");
    popover.id = "scores-popover";
    popover.style.position = "fixed";
    popover.style.top = "50%";
    popover.style.left = "50%";
    popover.style.transform = "translate(-50%, -50%)";
    popover.style.background = "#fff";
    popover.style.border = "1px solid #ccc";
    popover.style.borderRadius = "8px";
    popover.style.boxShadow = "0 2px 16px rgba(0,0,0,0.2)";
    popover.style.padding = "24px 24px 16px 24px";
    popover.style.zIndex = "1000";
    popover.style.minWidth = "420px";
    popover.style.display = "none";
    popover.innerHTML = `
      <button id="close-scores-popover" style="position:absolute;top:8px;right:12px;font-size:18px;background:none;border:none;cursor:pointer;">&times;</button>
      <h2 style="margin-top:0;text-align:center;">Recent Scores</h2>
      <div id="scores-table-container"></div>
    `;
    document.body.appendChild(popover);
    document.getElementById("close-scores-popover").onclick = () => {
      popover.style.display = "none";
    };
  }

  let tableHtml = `<table style="width:100%;border-collapse:collapse;text-align:center;">
    <thead>
      <tr style="background:#f5f5f5;">
        <th style="padding:6px 8px;border-bottom:1px solid #ccc;">Timestamp</th>
        <th style="padding:6px 8px;border-bottom:1px solid #ccc;">Avg Reaction (ms)</th>
        <th style="padding:6px 8px;border-bottom:1px solid #ccc;">Missed Greens</th>
        <th style="padding:6px 8px;border-bottom:1px solid #ccc;">Incorrect Clicks</th>
        <th style="padding:6px 8px;border-bottom:1px solid #ccc;">Score</th>
      </tr>
    </thead>
    <tbody>`;
  gameResults.forEach((result) => {
    tableHtml += `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${result.timestamp
        .slice(0, 19)
        .replace("T", " ")}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${
        result.averageTime
      }</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${
        result.missedGreenTargets ?? 0
      }</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${
        result.incorrectClicks ?? 0
      }</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${
        result.score ?? ""
      }</td>
    </tr>`;
  });
  tableHtml += "</tbody></table>";
  popover.querySelector("#scores-table-container").innerHTML = tableHtml;
  popover.style.display = "block";
}

export function setupScoresButton() {
  const scores = document.getElementById("scores");
  if (scores) {
    scores.addEventListener("click", showScoresPopover);
  }
}
