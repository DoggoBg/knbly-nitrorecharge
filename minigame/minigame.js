(() => {
    const app = document.getElementById('minigame-app');
    if (!app) return;

    const hint = document.getElementById('mg-hint');
    const step = document.getElementById('mg-step');
    const pipe = document.getElementById('mg-pipe');
    const connectTarget = document.getElementById('mg-connect-target');
    const liquid = document.getElementById('mg-liquid');
    const gasStream = document.getElementById('mg-gas-stream');
    const gaugeNeedle = document.getElementById('mg-gauge-needle');
    const gaugeValue = document.getElementById('mg-gauge-value');
    const valveWrap = document.getElementById('mg-valve-wrap');
    const valveKnob = document.getElementById('mg-valve-knob');
    const valveShape = document.getElementById('mg-valve-shape');
    const valveProgressFill = document.getElementById('mg-valve-progress-fill');
    const bottleZone = document.getElementById('mg-bottle-zone');
    const hoseLine = document.getElementById('mg-hose-line');
    const hoseShadow = document.getElementById('mg-hose-shadow');
    const hoseAnchor = document.getElementById('mg-hose-anchor');

    let FILL_DURATION = 7000;
    let VALVE_CLOSE_AMOUNT = 1600;
    let VALVE_CLOSE_SENSITIVITY = 0.55;
    const NOZZLE_HOME = { left: 120, top: 168 };

    let phase = 0;
    let draggingPipe = false;
    let draggingValve = false;
    let pipeOffset = { x: 0, y: 0 };
    let valveClosedAmount = 0;
    let fillInterval = null;
    let fillStart = 0;
    let hoseAnchorPoint = { x: 12, y: 230 };

    function post(name, data = {}) {
        fetch(`https://${GetParentResourceName()}/${name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify(data),
        });
    }

    function getStageRect() {
        return app.querySelector('.mg-stage').getBoundingClientRect();
    }

    function refreshHoseAnchor() {
        const stage = getStageRect();
        const anchorRect = hoseAnchor.getBoundingClientRect();
        hoseAnchorPoint = {
            x: anchorRect.right - stage.left - 4,
            y: anchorRect.top + anchorRect.height / 2 - stage.top,
        };
    }

    function updateHose() {
        refreshHoseAnchor();
        const stage = getStageRect();
        const join = pipe.querySelector('.mg-nozzle-hose-join').getBoundingClientRect();
        const x2 = join.left + join.width / 2 - stage.left;
        const y2 = join.top + join.height / 2 - stage.top;

        [hoseLine, hoseShadow].forEach((line) => {
            line.setAttribute('x1', '-140');
            line.setAttribute('y1', hoseAnchorPoint.y);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
        });
    }

    function setNozzlePosition(left, top) {
        pipe.style.left = `${left}px`;
        pipe.style.top = `${top}px`;
        updateHose();
    }

    function resetMinigame() {
        phase = 0;
        draggingPipe = false;
        draggingValve = false;
        valveClosedAmount = 0;
        fillStart = 0;

        if (fillInterval) {
            clearInterval(fillInterval);
            fillInterval = null;
        }

        pipe.classList.remove('dragging', 'connected');
        setNozzlePosition(NOZZLE_HOME.left, NOZZLE_HOME.top);

        connectTarget.classList.remove('active');
        liquid.style.height = '6%';
        liquid.classList.remove('filling');
        gasStream.classList.remove('active');

        gaugeNeedle.style.transform = 'rotate(-125deg)';
        gaugeValue.textContent = '0%';

        valveWrap.classList.remove('show');
        valveShape.style.transform = 'rotate(0deg)';
        valveProgressFill.style.width = '0%';

        step.textContent = 'Step 1 / 3';
        hint.textContent = 'Drag the fill hose onto the top of the bottle';
    }

    function openMinigame() {
        resetMinigame();
        phase = 1;
        app.classList.remove('hidden');
        connectTarget.classList.add('active');
        requestAnimationFrame(updateHose);
        post('minigameReady');
    }

    function closeMinigame() {
        app.classList.add('hidden');
        resetMinigame();
    }

    function rectsOverlap(a, b) {
        return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
    }

    function snapNozzleToBottle() {
        const stage = getStageRect();
        const targetRect = connectTarget.getBoundingClientRect();
        const left = targetRect.left - stage.left - 96;
        const top = targetRect.top - stage.top - 18;
        setNozzlePosition(left, top);
    }

    function startPhaseFill() {
        phase = 2;
        step.textContent = 'Step 2 / 3';
        hint.textContent = 'Pressurizing bottle... keep steady';
        connectTarget.classList.remove('active');
        pipe.classList.add('connected');
        snapNozzleToBottle();

        liquid.classList.add('filling');
        gasStream.classList.add('active');

        post('minigamePhase', { phase: 'fill' });

        fillStart = Date.now();
        fillInterval = setInterval(() => {
            const elapsed = Date.now() - fillStart;
            const progress = Math.min(elapsed / FILL_DURATION, 1);
            const percent = Math.round(progress * 100);

            liquid.style.height = `${6 + progress * 76}%`;
            gaugeNeedle.style.transform = `rotate(${-125 + progress * 185}deg)`;
            gaugeValue.textContent = `${percent}%`;

            if (progress >= 1) {
                clearInterval(fillInterval);
                fillInterval = null;
                startPhaseClose();
            }
        }, 50);
    }

    function startPhaseClose() {
        phase = 3;
        step.textContent = 'Step 3 / 3';
        hint.textContent = 'Turn the tap to close the bottle — take your time';
        gasStream.classList.remove('active');
        liquid.classList.remove('filling');
        valveWrap.classList.add('show');
        post('minigamePhase', { phase: 'close' });
    }

    function completeMinigame() {
        hint.textContent = 'Bottle sealed!';
        post('minigameComplete');
        setTimeout(closeMinigame, 350);
    }

    function onPipePointerDown(event) {
        if (phase !== 1 || pipe.classList.contains('connected')) return;
        draggingPipe = true;
        pipe.classList.add('dragging');
        const rect = pipe.getBoundingClientRect();
        pipeOffset.x = event.clientX - rect.left;
        pipeOffset.y = event.clientY - rect.top;
        pipe.setPointerCapture(event.pointerId);
    }

    function onPipePointerMove(event) {
        if (!draggingPipe) return;
        const stage = getStageRect();
        setNozzlePosition(
            event.clientX - stage.left - pipeOffset.x,
            event.clientY - stage.top - pipeOffset.y
        );
    }

    function onPipePointerUp(event) {
        if (!draggingPipe) return;
        draggingPipe = false;
        pipe.classList.remove('dragging');
        pipe.releasePointerCapture(event.pointerId);

        const spout = pipe.querySelector('.mg-nozzle-spout').getBoundingClientRect();
        const targetRect = connectTarget.getBoundingClientRect();

        if (rectsOverlap(spout, targetRect)) {
            startPhaseFill();
            return;
        }

        setNozzlePosition(NOZZLE_HOME.left, NOZZLE_HOME.top);
    }

    let valveLastX = 0;

    function onValvePointerDown(event) {
        if (phase !== 3) return;
        draggingValve = true;
        valveLastX = event.clientX;
        valveKnob.classList.add('dragging');
        valveKnob.setPointerCapture(event.pointerId);
    }

    function onValvePointerMove(event) {
        if (!draggingValve) return;

        const delta = event.clientX - valveLastX;
        valveLastX = event.clientX;
        valveClosedAmount += Math.abs(delta) * VALVE_CLOSE_SENSITIVITY;
        valveShape.style.transform = `rotate(${valveClosedAmount}deg)`;
        valveProgressFill.style.width = `${Math.min((valveClosedAmount / VALVE_CLOSE_AMOUNT) * 100, 100)}%`;

        if (valveClosedAmount >= VALVE_CLOSE_AMOUNT) {
            draggingValve = false;
            valveKnob.classList.remove('dragging');
            completeMinigame();
        }
    }

    function onValvePointerUp(event) {
        if (!draggingValve) return;
        draggingValve = false;
        valveKnob.classList.remove('dragging');
        valveKnob.releasePointerCapture(event.pointerId);
    }

    pipe.addEventListener('pointerdown', onPipePointerDown);
    pipe.addEventListener('pointermove', onPipePointerMove);
    pipe.addEventListener('pointerup', onPipePointerUp);
    pipe.addEventListener('pointercancel', onPipePointerUp);

    valveKnob.addEventListener('pointerdown', onValvePointerDown);
    valveKnob.addEventListener('pointermove', onValvePointerMove);
    valveKnob.addEventListener('pointerup', onValvePointerUp);
    valveKnob.addEventListener('pointercancel', onValvePointerUp);

    window.addEventListener('resize', updateHose);

    window.addEventListener('message', (event) => {
        const { action, data } = event.data;
        if (action === 'openMinigame') {
            if (data) {
                if (data.fillDuration) FILL_DURATION = data.fillDuration;
                if (data.valveCloseAmount) VALVE_CLOSE_AMOUNT = data.valveCloseAmount;
                if (data.valveCloseSensitivity) VALVE_CLOSE_SENSITIVITY = data.valveCloseSensitivity;
            }
            openMinigame();
        }
        if (action === 'closeMinigame') {
            closeMinigame();
        }
    });
})();
