(() => {
    const app = document.getElementById('empty-minigame-app');
    if (!app) return;

    const hint = document.getElementById('em-hint');
    const step = document.getElementById('em-step');
    const valveWrap = document.getElementById('em-valve-wrap');
    const valveKnob = document.getElementById('em-valve-knob');
    const valveShape = document.getElementById('em-valve-shape');
    const valveProgressFill = document.getElementById('em-valve-progress-fill');
    const neck = document.getElementById('em-neck');
    const liquid = document.getElementById('em-liquid');
    const ventStream = document.getElementById('em-vent-stream');
    const gaugeNeedle = document.getElementById('em-gauge-needle');
    const gaugeValue = document.getElementById('em-gauge-value');

    let VENT_DURATION = 8000;
    let VALVE_OPEN_AMOUNT = 1400;
    let VALVE_OPEN_SENSITIVITY = 0.55;

    let phase = 0;
    let draggingValve = false;
    let valveOpenedAmount = 0;
    let valveLastX = 0;
    let ventInterval = null;
    let ventStart = 0;

    function post(name, data = {}) {
        fetch(`https://${GetParentResourceName()}/${name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify(data),
        });
    }

    function resetEmptyMinigame() {
        phase = 0;
        draggingValve = false;
        valveOpenedAmount = 0;
        ventStart = 0;

        if (ventInterval) {
            clearInterval(ventInterval);
            ventInterval = null;
        }

        valveWrap.classList.remove('removed');
        valveShape.style.transform = 'rotate(0deg)';
        valveProgressFill.style.width = '0%';
        neck.classList.remove('open');

        liquid.style.height = '82%';
        liquid.classList.remove('venting');
        ventStream.classList.remove('active');

        gaugeNeedle.style.transform = 'rotate(60deg)';
        gaugeValue.textContent = '100%';
        gaugeValue.classList.remove('empty');

        step.textContent = 'Step 1 / 2';
        hint.textContent = 'Turn the tap to remove the bottle top';
    }

    function openEmptyMinigame() {
        resetEmptyMinigame();
        phase = 1;
        app.classList.remove('hidden');
        post('minigameReady');
    }

    function closeEmptyMinigame() {
        app.classList.add('hidden');
        resetEmptyMinigame();
    }

    function startPhaseVent() {
        phase = 2;
        step.textContent = 'Step 2 / 2';
        hint.textContent = 'Venting bottle... watch pressure drop to 0%';
        valveWrap.classList.add('removed');
        neck.classList.add('open');
        liquid.classList.add('venting');
        ventStream.classList.add('active');

        post('minigamePhase', { phase: 'vent' });

        ventStart = Date.now();
        ventInterval = setInterval(() => {
            const elapsed = Date.now() - ventStart;
            const progress = Math.min(elapsed / VENT_DURATION, 1);
            const percent = Math.round((1 - progress) * 100);

            liquid.style.height = `${6 + (1 - progress) * 76}%`;
            gaugeNeedle.style.transform = `rotate(${60 - progress * 185}deg)`;
            gaugeValue.textContent = `${percent}%`;

            if (percent <= 0) {
                gaugeValue.classList.add('empty');
            }

            if (progress >= 1) {
                clearInterval(ventInterval);
                ventInterval = null;
                completeEmptyMinigame();
            }
        }, 50);
    }

    function completeEmptyMinigame() {
        hint.textContent = 'Bottle fully emptied!';
        ventStream.classList.remove('active');
        liquid.classList.remove('venting');
        post('minigameComplete');
        setTimeout(closeEmptyMinigame, 350);
    }

    function onValvePointerDown(event) {
        if (phase !== 1) return;
        draggingValve = true;
        valveLastX = event.clientX;
        valveKnob.classList.add('dragging');
        valveKnob.setPointerCapture(event.pointerId);
    }

    function onValvePointerMove(event) {
        if (!draggingValve) return;

        const delta = event.clientX - valveLastX;
        valveLastX = event.clientX;
        valveOpenedAmount += Math.abs(delta) * VALVE_OPEN_SENSITIVITY;
        valveShape.style.transform = `rotate(-${valveOpenedAmount}deg)`;
        valveProgressFill.style.width = `${Math.min((valveOpenedAmount / VALVE_OPEN_AMOUNT) * 100, 100)}%`;

        if (valveOpenedAmount >= VALVE_OPEN_AMOUNT) {
            draggingValve = false;
            valveKnob.classList.remove('dragging');
            startPhaseVent();
        }
    }

    function onValvePointerUp(event) {
        if (!draggingValve) return;
        draggingValve = false;
        valveKnob.classList.remove('dragging');
        valveKnob.releasePointerCapture(event.pointerId);
    }

    valveKnob.addEventListener('pointerdown', onValvePointerDown);
    valveKnob.addEventListener('pointermove', onValvePointerMove);
    valveKnob.addEventListener('pointerup', onValvePointerUp);
    valveKnob.addEventListener('pointercancel', onValvePointerUp);

    window.addEventListener('message', (event) => {
        const { action, data } = event.data;
        if (action === 'openEmptyMinigame') {
            if (data) {
                if (data.ventDuration) VENT_DURATION = data.ventDuration;
                if (data.valveOpenAmount) VALVE_OPEN_AMOUNT = data.valveOpenAmount;
                if (data.valveOpenSensitivity) VALVE_OPEN_SENSITIVITY = data.valveOpenSensitivity;
            }
            openEmptyMinigame();
        }
        if (action === 'closeEmptyMinigame') {
            closeEmptyMinigame();
        }
    });
})();
