const app = document.getElementById('app');
const panel = document.querySelector('.panel');
const statusBanner = document.getElementById('status-banner');
const subtitle = document.getElementById('subtitle');
const menuActions = document.getElementById('menu-actions');
const resultActions = document.getElementById('result-actions');
const bottleBody = document.querySelector('.bottle-body');
const bottleLiquid = document.querySelector('.bottle-liquid');

const btnClose = document.getElementById('btn-close');
const btnDone = document.getElementById('btn-done');

const refillButtons = [
    document.getElementById('btn-refill-1'),
    document.getElementById('btn-refill-2'),
    document.getElementById('btn-refill-3'),
];

const emptyButtons = [
    document.getElementById('btn-empty-1'),
    document.getElementById('btn-empty-2'),
    document.getElementById('btn-empty-3'),
];

function post(name, data = {}) {
    fetch(`https://${GetParentResourceName()}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(data),
    });
}

function setBottleState(state) {
    const isFull = state === 'full';
    statusBanner.textContent = isFull ? 'FULL' : 'EMPTY';
    statusBanner.classList.toggle('full', isFull);
    bottleBody.classList.toggle('full', isFull);
    bottleBody.classList.toggle('empty', !isFull);
    bottleLiquid.classList.toggle('full', isFull);
    bottleLiquid.classList.toggle('empty', !isFull);
    panel.classList.toggle('empty-state', !isFull);
    panel.classList.toggle('result', isFull);
}

function setBatchButtons(buttons, available) {
    buttons.forEach((btn, index) => {
        if (!btn) return;
        btn.disabled = available < index + 1;
    });
}

function openMenu(data) {
    panel.classList.remove('result');
    menuActions.classList.remove('hidden');
    resultActions.classList.add('hidden');

    const emptyCount = data.hasEmpty || 0;
    const fullCount = data.hasFull || 0;

    setBatchButtons(refillButtons, emptyCount);
    setBatchButtons(emptyButtons, fullCount);

    if (emptyCount > 0) {
        setBottleState('empty');
        subtitle.textContent = `You have ${emptyCount} empty bottle${emptyCount === 1 ? '' : 's'}. Choose how many to refill (1/3, 2/3, or 3/3).`;
    } else {
        setBottleState('empty');
        subtitle.textContent = 'You need empty nitrous bottles to start refilling.';
    }

    if (fullCount === 0 && emptyCount === 0) {
        subtitle.textContent = 'You need bottles in your inventory to use this bench.';
    }
}

function openResult(data) {
    panel.classList.add('result');
    menuActions.classList.add('hidden');
    resultActions.classList.remove('hidden');

    const state = data.bottleState === 'full' ? 'full' : 'empty';
    const count = data.bottleCount || 1;
    setBottleState(state);

    if (state === 'full') {
        subtitle.textContent = count === 1
            ? 'Bottle is pressurized and ready. Confirm to receive it.'
            : `${count} bottles are pressurized and ready. Confirm to receive them.`;
    } else {
        subtitle.textContent = count === 1
            ? 'Bottle has been vented. Confirm to receive your empty bottle.'
            : `${count} bottles have been vented. Confirm to receive your empty bottles.`;
    }
}

window.addEventListener('message', (event) => {
    const { action, data } = event.data;
    if (action === 'open') {
        app.classList.remove('hidden');
        if (data.mode === 'result') {
            openResult(data);
        } else {
            openMenu(data);
        }
    }

    if (action === 'close') {
        app.classList.add('hidden');
    }
});

btnClose.addEventListener('click', () => post('close'));
btnDone.addEventListener('click', () => post('done'));

refillButtons.forEach((btn) => {
    if (!btn) return;
    btn.addEventListener('click', () => post('startRefill', { count: Number(btn.dataset.count) }));
});

emptyButtons.forEach((btn) => {
    if (!btn) return;
    btn.addEventListener('click', () => post('startEmpty', { count: Number(btn.dataset.count) }));
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        post('close');
    }
});
