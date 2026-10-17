import {
  brierScore,
  drawOutcome,
  meanBrierScore,
  probabilityFromCounts
} from './forecast-loom-core.mjs';

const vessels = [
  { name: 'Moon vessel', target: 'moon', glyph: '☾', other: 'amber', otherGlyph: '◇', favorable: 1, total: 4 },
  { name: 'Leaf vessel', target: 'leaf', glyph: '❧', other: 'stone', otherGlyph: '○', favorable: 2, total: 5 },
  { name: 'Star vessel', target: 'star', glyph: '✦', other: 'ink', otherGlyph: '●', favorable: 3, total: 6 },
  { name: 'Rain vessel', target: 'drop', glyph: '◆', other: 'seed', otherGlyph: '✧', favorable: 3, total: 5 },
  { name: 'Sun vessel', target: 'sun', glyph: '☼', other: 'moss', otherGlyph: '⬟', favorable: 4, total: 5 }
];

const $ = (id) => document.getElementById(id);
const roundPanel = $('round-panel');
const summaryPanel = $('summary-panel');
const vesselTitle = $('vessel-title');
const vesselNumber = $('vessel-number');
const bag = $('token-bag');
const bagDescription = $('bag-description');
const forecast = $('forecast');
const forecastValue = $('forecast-value');
const drawButton = $('draw-button');
const resetButton = $('reset-button');
const feedback = $('feedback');
const feedbackTitle = $('feedback-title');
const feedbackCopy = $('feedback-copy');
const progress = $('progress');
const scoreReadout = $('score-readout');
const summaryScore = $('summary-score');
const summaryRows = $('summary-rows');

let index = 0;
let locked = false;
let results = [];

function plural(n, word) {
  return n + ' ' + word + (n === 1 ? '' : 's');
}

function renderVessel() {
  const vessel = vessels[index];
  const probability = probabilityFromCounts(vessel.favorable, vessel.total);
  const otherCount = vessel.total - vessel.favorable;
  vesselTitle.textContent = vessel.name;
  vesselNumber.textContent = 'Vessel ' + (index + 1) + ' of ' + vessels.length;
  bag.replaceChildren();

  for (let i = 0; i < vessel.total; i += 1) {
    const isTarget = i < vessel.favorable;
    const token = document.createElement('span');
    token.className = 'token ' + (isTarget ? 'token-target' : 'token-other');
    token.textContent = isTarget ? vessel.glyph : vessel.otherGlyph;
    token.setAttribute('aria-hidden', 'true');
    bag.append(token);
  }

  bagDescription.textContent =
    'The vessel contains ' + plural(vessel.favorable, vessel.target) +
    ' token' + (vessel.favorable === 1 ? '' : 's') + ' and ' +
    plural(otherCount, vessel.other) + ' token' + (otherCount === 1 ? '' : 's') +
    '. One token is selected uniformly at random. The target probability from these counts is ' +
    Math.round(probability * 100) + ' percent.';

  forecast.value = '50';
  forecastValue.value = '50%';
  forecastValue.textContent = '50%';
  forecast.disabled = false;
  locked = false;
  drawButton.disabled = false;
  drawButton.textContent = 'Lock forecast & draw';
  feedback.hidden = true;
  progress.textContent = 'Round ' + (index + 1) + ' of ' + vessels.length + ' · ' + results.length + ' scored';
  scoreReadout.textContent = results.length ? 'Last Brier score: ' + results[results.length - 1].score.toFixed(3) : 'No forecasts scored yet.';
}

function renderSummary() {
  roundPanel.hidden = true;
  summaryPanel.hidden = false;
  const mean = meanBrierScore(results);
  summaryScore.textContent = mean.toFixed(3);
  summaryRows.replaceChildren();

  results.forEach((row, i) => {
    const item = document.createElement('li');
    const label = document.createElement('strong');
    label.textContent = row.name + ': ';
    const detail = document.createElement('span');
    detail.textContent = 'forecast ' + Math.round(row.probability * 100) +
      '%, outcome ' + (row.outcome ? 'occurred' : 'did not occur') +
      ', Brier score ' + row.score.toFixed(3);
    item.append(label, detail);
    summaryRows.append(item);
  });
}

forecast.addEventListener('input', () => {
  forecastValue.value = forecast.value + '%';
  forecastValue.textContent = forecast.value + '%';
});

drawButton.addEventListener('click', () => {
  if (locked) {
    if (index < vessels.length - 1) {
      index += 1;
      renderVessel();
    } else {
      renderSummary();
    }
    return;
  }

  const vessel = vessels[index];
  const probability = Number(forecast.value) / 100;
  const trueProbability = probabilityFromCounts(vessel.favorable, vessel.total);
  const outcome = drawOutcome(trueProbability);
  const score = brierScore(probability, outcome);
  results.push({ name: vessel.name, probability, outcome, score });
  locked = true;
  forecast.disabled = true;
  drawButton.textContent = index < vessels.length - 1 ? 'Next vessel' : 'View run summary';
  feedback.hidden = false;
  feedbackTitle.textContent = outcome ? 'The target token appeared.' : 'The target token did not appear.';
  feedbackCopy.textContent =
    'Your forecast was ' + Math.round(probability * 100) + '%. The token odds were ' +
    vessel.favorable + ' of ' + vessel.total + ' (' + Math.round(trueProbability * 100) +
    '%). This draw scored ' + score.toFixed(3) +
    ' on the Brier scale: lower is better for this realized outcome, but one draw is noisy.';
  progress.textContent = 'Round ' + (index + 1) + ' of ' + vessels.length + ' · ' + results.length + ' scored';
  scoreReadout.textContent = 'Last Brier score: ' + score.toFixed(3);
});

resetButton.addEventListener('click', () => {
  index = 0;
  locked = false;
  results = [];
  summaryPanel.hidden = true;
  roundPanel.hidden = false;
  renderVessel();
});

renderVessel();
