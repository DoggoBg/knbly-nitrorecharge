(() => {
    const cancelHint = document.getElementById('process-cancel-hint');

    function post(name, data = {}) {
        fetch(`https://${GetParentResourceName()}/${name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify(data),
        });
    }

    function setCancelHint(visible) {
        if (!cancelHint) return;
        cancelHint.classList.toggle('hidden', !visible);
    }

    window.addEventListener('message', (event) => {
        const { action } = event.data || {};
        if (action === 'showCancelHint') setCancelHint(true);
        if (action === 'hideCancelHint') setCancelHint(false);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'x' && event.key !== 'X') return;
        if (!cancelHint || cancelHint.classList.contains('hidden')) return;
        post('cancelProcess');
    });
})();

(() => {
    const app = document.getElementById('minigame-app');
    if (!app) return;

    const panel = document.getElementById('mg-panel');
    const hint = document.getElementById('mg-hint');
    const step = document.getElementById('mg-step');
    const pipe = document.getElementById('mg-pipe');
    const singleLayout = document.getElementById('mg-single-layout');
    const multiLayout = document.getElementById('mg-multi-layout');
    const bottlesRow = document.getElementById('mg-bottles-row');
    const mgStage = app.querySelector('.mg-stage');
    const hoseLine = document.getElementById('mg-hose-line');
    const hoseShadow = document.getElementById('mg-hose-shadow');
    const hoseSheen = document.getElementById('mg-hose-sheen');
    const hoseShine = document.getElementById('mg-hose-shine');
    const hoseAnchor = document.getElementById('mg-hose-anchor');

    let FILL_DURATION = 7000;
    let VALVE_CLOSE_AMOUNT = 1600;
    let VALVE_CLOSE_SENSITIVITY = 0.55;
    const NOZZLE_HOME_SINGLE = { left: 64, top: 248 };
    const NOZZLE_HOME_MULTI = { left: 18, top: 262 };

    function getNozzleHome() {
        return bottleCount > 1 ? NOZZLE_HOME_MULTI : NOZZLE_HOME_SINGLE;
    }

    function returnNozzleHome() {
        const home = getNozzleHome();
        pipe.classList.remove('connected', 'dragging');
        setNozzlePosition(home.left, home.top);
    }

    function bindSingleBottle() {
        const zone = document.getElementById('mg-bottle-zone');
        const assembly = document.getElementById('mg-bottle-assembly');
        const slot = document.getElementById('mg-bottle-slot');
        return {
            slot: slot || zone,
            zone,
            assembly,
            connectTarget: document.getElementById('mg-connect-target'),
            gasStream: document.getElementById('mg-gas-stream'),
            liquid: document.getElementById('mg-liquid'),
            gaugeNeedle: document.getElementById('mg-gauge-needle'),
            gaugeValue: document.getElementById('mg-gauge-value'),
            valveWrap: document.getElementById('mg-valve-wrap'),
            valveKnob: document.getElementById('mg-valve-knob'),
            valveShape: document.getElementById('mg-valve-shape'),
            valveProgressFill: document.getElementById('mg-valve-progress-fill'),
            valveClosedAmount: 0,
            done: false,
        };
    }

    function sealBottle(bottle) {
        if (!bottle) return;
        bottle.done = true;
        bottle.connectTarget.classList.remove('active');
        bottle.gasStream.classList.remove('active');
        bottle.zone.classList.remove('cap-step');
        bottle.assembly.classList.remove('cap-on');
        bottle.valveWrap.classList.remove('show');
        if (bottle.slot && bottle.slot.classList) {
            bottle.slot.classList.add('done');
        }
    }

    let bottleCount = 1;
    let currentBottleIndex = 0;
    let bottles = [];
    let phase = 0;
    let draggingPipe = false;
    let draggingValve = false;
    let pipeOffset = { x: 0, y: 0 };
    let valveLastX = 0;
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

    function getCurrentBottle() {
        return bottles[currentBottleIndex] || null;
    }

    function buildRefillSlot(index) {
        const slot = document.createElement('div');
        slot.className = 'mg-bottle-slot';
        slot.dataset.index = String(index);
        slot.innerHTML = `
            <div class="mg-slot-label">Bottle ${index + 1}</div>
            <div class="mg-slot-body">
                <div class="mg-bottle-wrap">
                    <div class="mg-bottle">
                        <div class="mg-connect-target"></div>
                        <div class="mg-gas-stream"></div>
                        <div class="mg-valve-wrap">
                            <div class="mg-valve-knob">
                                <div class="mg-valve-knob-shape"></div>
                            </div>
                            <div class="mg-valve-neck"></div>
                            <div class="mg-valve-progress">
                                <div class="mg-valve-progress-fill"></div>
                            </div>
                        </div>
                        <div class="mg-bottle-open-neck bottle-neck-slot"></div>
                        <div class="mg-bottle-shell">
                            <div class="mg-liquid"></div>
                            <div class="mg-shine"></div>
                            <div class="mg-label">
                                <div class="mg-label-frame">
                                    <div class="mg-label-top"><span>›</span><span>NOS</span></div>
                                    <div class="mg-label-mid">N₂O • 10 LB</div>
                                    <div class="mg-label-foot">Nitrous Oxide Systems</div>
                                </div>
                            </div>
                        </div>
                        <div class="mg-foot"></div>
                    </div>
                </div>
                <div class="mg-slot-gauge-panel">
                    <div class="mg-gauge-label">PRESSURE</div>
                    <div class="mg-gauge">
                        <div class="mg-gauge-ring">
                            <div class="mg-gauge-face"></div>
                            <div class="mg-gauge-face-inner"></div>
                            <div class="mg-gauge-needle"></div>
                            <div class="mg-gauge-center"></div>
                        </div>
                    </div>
                    <div class="mg-gauge-value">0%</div>
                </div>
            </div>
        `;

        return {
            slot,
            zone: slot.querySelector('.mg-bottle-wrap'),
            assembly: slot.querySelector('.mg-bottle'),
            connectTarget: slot.querySelector('.mg-connect-target'),
            gasStream: slot.querySelector('.mg-gas-stream'),
            liquid: slot.querySelector('.mg-liquid'),
            gaugeNeedle: slot.querySelector('.mg-gauge-needle'),
            gaugeValue: slot.querySelector('.mg-gauge-value'),
            valveWrap: slot.querySelector('.mg-valve-wrap'),
            valveKnob: slot.querySelector('.mg-valve-knob'),
            valveShape: slot.querySelector('.mg-valve-knob-shape'),
            valveProgressFill: slot.querySelector('.mg-valve-progress-fill'),
            valveClosedAmount: 0,
            done: false,
        };
    }

    function buildRefillLayout(count) {
        bottleCount = count;
        currentBottleIndex = 0;
        bottles = [];

        if (panel) panel.className = count > 1 ? `mg-panel bottles-${count}` : 'mg-panel';

        if (count === 1) {
            if (singleLayout) singleLayout.classList.remove('hidden');
            if (multiLayout) multiLayout.classList.add('hidden');
            bottles = [bindSingleBottle()];
            return;
        }

        if (singleLayout) singleLayout.classList.add('hidden');
        if (multiLayout) multiLayout.classList.remove('hidden');
        if (!bottlesRow) return;

        bottlesRow.innerHTML = '';
        bottlesRow.className = `mg-bottles-row count-${count}`;

        for (let i = 0; i < count; i += 1) {
            const bottle = buildRefillSlot(i);
            bottles.push(bottle);
            bottlesRow.appendChild(bottle.slot);
        }
    }

    function refreshHoseAnchor() {
        const stage = getStageRect();
        const rib = hoseAnchor.querySelector('.mg-hose-rib');
        const anchorRect = (rib || hoseAnchor).getBoundingClientRect();
        hoseAnchorPoint = {
            x: anchorRect.right - stage.left - 2,
            y: anchorRect.top + anchorRect.height / 2 - stage.top,
        };
    }

    function updateHose() {
        refreshHoseAnchor();
        const stage = getStageRect();
        const join = pipe.querySelector('.mg-nozzle-hose-join').getBoundingClientRect();
        const x2 = join.left + join.width / 2 - stage.left;
        const y2 = join.top + join.height / 2 - stage.top;
        const x1 = hoseAnchorPoint.x;
        const y1 = hoseAnchorPoint.y;
        const sag = Math.max(32, Math.abs(x2 - x1) * 0.2);
        const cx = (x1 + x2) / 2;
        const cy = Math.max(y1, y2) + sag;
        const tailX = -130;
        const path = `M ${tailX} ${y1} L ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;

        [hoseShadow, hoseLine, hoseSheen, hoseShine].forEach((segment) => {
            if (segment) segment.setAttribute('d', path);
        });
    }

    function setNozzlePosition(left, top) {
        pipe.style.left = `${left}px`;
        pipe.style.top = `${top}px`;
        updateHose();
    }

    function bottleLabelPrefix() {
        if (bottleCount <= 1) return '';
        return `Bottle ${currentBottleIndex + 1} — `;
    }

    function setActiveBottle(index) {
        bottles.forEach((bottle, i) => {
            const isActive = i === index && !bottle.done;
            if (bottle.slot && bottle.slot.classList) {
                bottle.slot.classList.toggle('active', isActive);
                bottle.slot.classList.toggle('done', bottle.done);
            }
            bottle.connectTarget.classList.toggle('active', isActive && phase === 1);
        });
    }

    function resetBottleState(bottle) {
        bottle.valveClosedAmount = 0;
        bottle.done = false;
        bottle.connectTarget.classList.remove('active');
        bottle.gasStream.classList.remove('active');
        bottle.liquid.style.height = '6%';
        bottle.liquid.classList.remove('filling');
        bottle.gaugeNeedle.style.transform = 'rotate(-125deg)';
        bottle.gaugeValue.textContent = '0%';
        bottle.valveWrap.classList.remove('show');
        bottle.assembly.classList.remove('cap-on');
        bottle.zone.classList.remove('cap-step');
        bottle.valveShape.style.transform = 'rotate(0deg)';
        if (bottle.valveKnob) bottle.valveKnob.classList.remove('dragging');
        bottle.valveProgressFill.style.width = '0%';
    }

    function resetMinigame() {
        phase = 0;
        currentBottleIndex = 0;
        draggingPipe = false;
        draggingValve = false;
        fillStart = 0;

        if (fillInterval) {
            clearInterval(fillInterval);
            fillInterval = null;
        }

        pipe.classList.remove('dragging', 'connected');
        returnNozzleHome();

        bottles.forEach(resetBottleState);
        setActiveBottle(0);

        step.textContent = 'Step 1 / 3';
        hint.textContent = 'Drag the fill hose onto the top of the bottle';
    }

    function openMinigame() {
        resetMinigame();
        phase = 1;
        app.classList.remove('hidden');
        setActiveBottle(currentBottleIndex);
        requestAnimationFrame(updateHose);
        post('minigameReady');
    }

    function closeMinigame() {
        app.classList.add('hidden');
        resetMinigame();
    }

    function getNozzleHitRect() {
        const spout = pipe.querySelector('.mg-nozzle-spout').getBoundingClientRect();
        const body = pipe.querySelector('.mg-nozzle-body').getBoundingClientRect();
        return {
            left: Math.min(spout.left, body.left),
            top: Math.min(spout.top, body.top),
            right: Math.max(spout.right, body.right),
            bottom: Math.max(spout.bottom, body.bottom),
        };
    }

    function rectsOverlap(a, b, padding = 16) {
        return !(
            a.right + padding < b.left
            || a.left - padding > b.right
            || a.bottom + padding < b.top
            || a.top - padding > b.bottom
        );
    }

    function snapNozzleToBottle(bottle) {
        const targetEl = bottle.connectTarget || bottle.zone.querySelector('.mg-bottle-open-neck');
        const spout = pipe.querySelector('.mg-nozzle-spout');
        if (!targetEl || !spout) return;

        const target = targetEl.getBoundingClientRect();
        const targetX = target.left + target.width / 2;
        const targetY = target.top + target.height * 0.45;

        const home = getNozzleHome();
        const currentLeft = parseFloat(pipe.style.left) || home.left;
        const currentTop = parseFloat(pipe.style.top) || home.top;
        setNozzlePosition(currentLeft, currentTop);

        const spoutRect = spout.getBoundingClientRect();
        const spoutX = spoutRect.left + spoutRect.width / 2;
        const spoutY = spoutRect.top + spoutRect.height * 0.55;

        setNozzlePosition(
            currentLeft + (targetX - spoutX),
            currentTop + (targetY - spoutY)
        );
    }

    function startPhaseFill() {
        const bottle = getCurrentBottle();
        if (!bottle) return;

        phase = 2;
        step.textContent = `${bottleLabelPrefix()}Step 2 / 3`;
        hint.textContent = 'Pressurizing bottle... keep steady';
        bottle.connectTarget.classList.remove('active');
        pipe.classList.add('connected');
        snapNozzleToBottle(bottle);

        bottle.liquid.classList.add('filling');
        bottle.gasStream.classList.add('active');

        post('minigamePhase', { phase: 'fill' });

        fillStart = Date.now();
        fillInterval = setInterval(() => {
            const elapsed = Date.now() - fillStart;
            const progress = Math.min(elapsed / FILL_DURATION, 1);
            const percent = Math.round(progress * 100);

            bottle.liquid.style.height = `${6 + progress * 76}%`;
            bottle.gaugeNeedle.style.transform = `rotate(${-125 + progress * 185}deg)`;
            bottle.gaugeValue.textContent = `${percent}%`;

            if (progress >= 0.05) {
                snapNozzleToBottle(bottle);
            }

            if (progress >= 1) {
                clearInterval(fillInterval);
                fillInterval = null;
                startPhaseClose();
            }
        }, 50);
    }

    function startPhaseClose() {
        const bottle = getCurrentBottle();
        if (!bottle) return;

        phase = 3;
        step.textContent = `${bottleLabelPrefix()}Step 3 / 3`;
        hint.textContent = 'Turn the tap to close the bottle — take your time';
        bottle.gasStream.classList.remove('active');
        bottle.liquid.classList.remove('filling');
        bottle.zone.classList.add('cap-step');
        bottle.assembly.classList.add('cap-on');
        bottle.valveWrap.classList.add('show');
        returnNozzleHome();
        post('minigamePhase', { phase: 'close' });
    }

    function advanceToNextBottle() {
        sealBottle(getCurrentBottle());

        if (currentBottleIndex >= bottleCount - 1) {
            completeMinigame();
            return;
        }

        currentBottleIndex += 1;
        phase = 1;
        returnNozzleHome();
        step.textContent = `${bottleLabelPrefix()}Step 1 / 3`;
        hint.textContent = 'Drag the fill hose onto the top of the next bottle';
        setActiveBottle(currentBottleIndex);
        requestAnimationFrame(updateHose);
    }

    function completeMinigame() {
        hint.textContent = bottleCount === 1 ? 'Bottle sealed!' : 'All bottles sealed!';
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

        const bottle = getCurrentBottle();
        if (!bottle) return;

        const hitRect = getNozzleHitRect();
        const targetRect = bottle.connectTarget.getBoundingClientRect();

        if (rectsOverlap(hitRect, targetRect, 20)) {
            startPhaseFill();
            return;
        }

        returnNozzleHome();
    }

    function onValvePointerDown(event) {
        const bottle = getCurrentBottle();
        if (phase !== 3 || !bottle || !event.target.closest('.mg-valve-knob-shape')) return;
        if (bottle.slot && !bottle.slot.contains(event.target)) return;

        draggingValve = true;
        valveLastX = event.clientX;
        bottle.valveKnob.classList.add('dragging');
        bottle.valveKnob.setPointerCapture(event.pointerId);
    }

    function onValvePointerMove(event) {
        if (!draggingValve) return;
        const bottle = getCurrentBottle();
        if (!bottle || phase !== 3) return;

        const delta = event.clientX - valveLastX;
        valveLastX = event.clientX;
        bottle.valveClosedAmount += Math.abs(delta) * VALVE_CLOSE_SENSITIVITY;
        bottle.valveShape.style.transform = `rotate(${bottle.valveClosedAmount}deg)`;
        bottle.valveProgressFill.style.width = `${Math.min((bottle.valveClosedAmount / VALVE_CLOSE_AMOUNT) * 100, 100)}%`;

        if (bottle.valveClosedAmount >= VALVE_CLOSE_AMOUNT) {
            draggingValve = false;
            bottle.valveKnob.classList.remove('dragging');
            advanceToNextBottle();
        }
    }

    function onValvePointerUp(event) {
        if (!draggingValve) return;
        const bottle = getCurrentBottle();
        draggingValve = false;
        if (bottle && bottle.valveKnob) {
            bottle.valveKnob.classList.remove('dragging');
            bottle.valveKnob.releasePointerCapture(event.pointerId);
        }
    }

    pipe.addEventListener('pointerdown', onPipePointerDown);
    pipe.addEventListener('pointermove', onPipePointerMove);
    pipe.addEventListener('pointerup', onPipePointerUp);
    pipe.addEventListener('pointercancel', onPipePointerUp);

    if (mgStage) {
        mgStage.addEventListener('pointerdown', onValvePointerDown);
        mgStage.addEventListener('pointermove', onValvePointerMove);
        mgStage.addEventListener('pointerup', onValvePointerUp);
        mgStage.addEventListener('pointercancel', onValvePointerUp);
    }

    window.addEventListener('resize', updateHose);

    window.addEventListener('message', (event) => {
        const { action, data } = event.data || {};
        if (action === 'openMinigame') {
            const count = Math.min(Math.max(Number(data && data.bottleCount) || 1, 1), 3);
            if (data) {
                if (data.fillDuration) FILL_DURATION = data.fillDuration;
                if (data.valveCloseAmount) VALVE_CLOSE_AMOUNT = data.valveCloseAmount;
                if (data.valveCloseSensitivity) VALVE_CLOSE_SENSITIVITY = data.valveCloseSensitivity;
            }
            buildRefillLayout(count);
            returnNozzleHome();
            openMinigame();
        }
        if (action === 'closeMinigame') {
            closeMinigame();
        }
    });
})();

(() => {
    const app = document.getElementById('empty-minigame-app');
    if (!app) return;

    const panel = document.getElementById('em-panel');
    const hint = document.getElementById('em-hint');
    const step = document.getElementById('em-step');
    const singleLayout = document.getElementById('em-single-layout');
    const multiLayout = document.getElementById('em-multi-layout');
    const bottlesRow = document.getElementById('em-bottles-row');
    const emStage = app.querySelector('.em-stage');

    let VENT_DURATION = 8000;
    let VALVE_OPEN_AMOUNT = 1400;
    let VALVE_OPEN_SENSITIVITY = 0.55;

    let bottleCount = 1;
    let bottles = [];
    let minigameActive = false;
    let draggingValve = false;
    let draggingBottle = null;
    let valveLastX = 0;
    let ventPhaseSent = false;

    function post(name, data = {}) {
        fetch(`https://${GetParentResourceName()}/${name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify(data),
        });
    }

    function buildEmptySlot(index) {
        const slot = document.createElement('div');
        slot.className = 'em-bottle-slot';
        slot.dataset.index = String(index);
        slot.innerHTML = `
            <div class="em-slot-label">Bottle ${index + 1}</div>
            <div class="em-slot-body">
                <div class="em-bottle-wrap">
                    <div class="em-valve-wrap">
                        <span class="em-valve-label">Turn to remove</span>
                        <div class="em-valve-knob">
                            <div class="em-valve-shape"></div>
                        </div>
                        <div class="em-valve-neck"></div>
                        <div class="em-valve-progress">
                            <div class="em-valve-progress-fill"></div>
                        </div>
                    </div>
                    <div class="em-bottle cap-on">
                        <div class="em-vent-spray">
                            <div class="em-spray-jet"></div>
                            <div class="em-spray-cloud"></div>
                            <span class="em-mist m1"></span>
                            <span class="em-mist m2"></span>
                            <span class="em-mist m3"></span>
                            <span class="em-mist m4"></span>
                            <span class="em-mist m5"></span>
                            <span class="em-mist m6"></span>
                            <span class="em-mist m7"></span>
                            <span class="em-mist m8"></span>
                        </div>
                        <div class="em-neck bottle-neck-slot"></div>
                        <div class="em-shell-body">
                            <div class="em-liquid"></div>
                            <div class="em-shine"></div>
                            <div class="em-label">
                                <div class="em-label-frame">
                                    <div class="em-label-top"><span>›</span><span>NOS</span></div>
                                    <div class="em-label-mid">N₂O • 10 LB</div>
                                    <div class="em-label-foot">Nitrous Oxide Systems</div>
                                </div>
                            </div>
                        </div>
                        <div class="em-foot"></div>
                    </div>
                </div>
                <div class="em-slot-gauge-panel">
                    <div class="em-gauge-label">PRESSURE</div>
                    <div class="em-gauge">
                        <div class="em-gauge-ring">
                            <div class="em-gauge-face"></div>
                            <div class="em-gauge-face-inner"></div>
                            <div class="em-gauge-needle"></div>
                            <div class="em-gauge-center"></div>
                        </div>
                    </div>
                    <div class="em-gauge-value">100%</div>
                </div>
            </div>
        `;

        return {
            slot,
            assembly: slot.querySelector('.em-bottle'),
            valveWrap: slot.querySelector('.em-valve-wrap'),
            valveKnob: slot.querySelector('.em-valve-knob'),
            valveShape: slot.querySelector('.em-valve-shape'),
            valveProgressFill: slot.querySelector('.em-valve-progress-fill'),
            neck: slot.querySelector('.em-neck'),
            liquid: slot.querySelector('.em-liquid'),
            ventSpray: slot.querySelector('.em-vent-spray'),
            gaugeNeedle: slot.querySelector('.em-gauge-needle'),
            gaugeValue: slot.querySelector('.em-gauge-value'),
            valveOpenedAmount: 0,
            state: 'capped',
            ventInterval: null,
            ventStart: 0,
            done: false,
        };
    }

    function bindSingleEmptyBottle() {
        const assembly = document.getElementById('em-bottle-assembly');
        const slot = singleLayout ? singleLayout.querySelector('.em-bottle-slot') : null;
        return {
            slot,
            assembly,
            valveWrap: document.getElementById('em-valve-wrap'),
            valveKnob: document.getElementById('em-valve-knob'),
            valveShape: document.getElementById('em-valve-shape'),
            valveProgressFill: document.getElementById('em-valve-progress-fill'),
            neck: document.getElementById('em-neck'),
            liquid: document.getElementById('em-liquid'),
            ventSpray: document.getElementById('em-vent-spray'),
            gaugeNeedle: document.getElementById('em-gauge-needle'),
            gaugeValue: document.getElementById('em-gauge-value'),
            valveOpenedAmount: 0,
            state: 'capped',
            ventInterval: null,
            ventStart: 0,
            done: false,
        };
    }

    function buildEmptyLayout(count) {
        bottleCount = count;
        bottles = [];
        ventPhaseSent = false;

        if (panel) panel.className = count > 1 ? `em-panel bottles-${count}` : 'em-panel';

        if (count === 1) {
            if (singleLayout) singleLayout.classList.remove('hidden');
            if (multiLayout) multiLayout.classList.add('hidden');
            bottles = [bindSingleEmptyBottle()];
            return;
        }

        if (singleLayout) singleLayout.classList.add('hidden');
        if (multiLayout) multiLayout.classList.remove('hidden');
        if (!bottlesRow) return;

        bottlesRow.innerHTML = '';
        bottlesRow.className = `em-bottles-row count-${count}`;

        for (let i = 0; i < count; i += 1) {
            const bottle = buildEmptySlot(i);
            bottles.push(bottle);
            bottlesRow.appendChild(bottle.slot);
        }

        updateAllSlotClasses();
    }

    function findBottleByCap(target) {
        const hit = target.closest('.em-valve-shape');
        if (!hit) return null;
        return bottles.find((bottle) => bottle.valveShape === hit && bottle.state === 'capped') || null;
    }

    function updateBottleSlotClass(bottle) {
        if (!bottle.slot || !bottle.slot.classList) return;
        bottle.slot.classList.toggle('ready', bottle.state === 'capped');
        bottle.slot.classList.toggle('venting', bottle.state === 'venting');
        bottle.slot.classList.toggle('done', bottle.state === 'done');
        bottle.slot.classList.remove('active');
    }

    function updateAllSlotClasses() {
        bottles.forEach(updateBottleSlotClass);
    }

    function countByState(state) {
        return bottles.filter((b) => b.state === state).length;
    }

    function updateEmptyHint() {
        const capped = countByState('capped');
        const venting = countByState('venting');
        const done = countByState('done');

        if (bottleCount === 1) {
            if (capped === 1) {
                hint.textContent = 'Turn the tap to remove the bottle top';
            } else if (venting === 1) {
                hint.textContent = 'Venting bottle... watch pressure drop to 0%';
            }
            return;
        }

        if (capped > 0 && venting > 0) {
            hint.textContent = `${venting} venting — open ${capped} more cap${capped === 1 ? '' : 's'} while they empty`;
        } else if (capped > 0) {
            hint.textContent = `Open caps in any order — ${capped} left (no need to wait for others)`;
        } else if (venting > 0) {
            hint.textContent = `${venting} bottle${venting === 1 ? '' : 's'} venting... wait for 0%`;
        } else if (done === bottleCount) {
            hint.textContent = 'All bottles fully emptied!';
        }
    }

    function updateEmptyStep() {
        const venting = countByState('venting');
        const done = countByState('done');

        if (bottleCount === 1) {
            step.textContent = done === 1 ? 'Step 2 / 2' : 'Step 1 / 2';
            return;
        }

        step.textContent = `${done}/${bottleCount} empty · ${venting} venting`;
    }

    function allBottlesDone() {
        return bottles.length > 0 && bottles.every((b) => b.state === 'done');
    }

    function resetBottleState(bottle) {
        if (bottle.ventInterval) {
            clearInterval(bottle.ventInterval);
            bottle.ventInterval = null;
        }

        bottle.valveOpenedAmount = 0;
        bottle.state = 'capped';
        bottle.done = false;
        bottle.ventStart = 0;
        bottle.valveWrap.classList.remove('removed');
        bottle.assembly.classList.add('cap-on');
        bottle.valveShape.style.transform = 'rotate(0deg)';
        if (bottle.valveKnob) bottle.valveKnob.classList.remove('dragging');
        bottle.valveProgressFill.style.width = '0%';
        bottle.neck.classList.remove('open');
        bottle.liquid.style.height = '82%';
        bottle.liquid.classList.remove('venting');
        bottle.ventSpray.classList.remove('active');
        bottle.ventSpray.style.setProperty('--vent-power', '1');
        bottle.gaugeNeedle.style.transform = 'rotate(60deg)';
        bottle.gaugeValue.textContent = '100%';
        bottle.gaugeValue.classList.remove('empty');
        updateBottleSlotClass(bottle);
    }

    function resetEmptyMinigame() {
        minigameActive = false;
        draggingValve = false;
        draggingBottle = null;
        ventPhaseSent = false;

        bottles.forEach(resetBottleState);
        updateEmptyHint();
        updateEmptyStep();
    }

    function openEmptyMinigame() {
        resetEmptyMinigame();
        minigameActive = true;
        app.classList.remove('hidden');
        updateEmptyHint();
        updateEmptyStep();
        post('minigameReady');
    }

    function closeEmptyMinigame() {
        app.classList.add('hidden');
        resetEmptyMinigame();
    }

    function startBottleVent(bottle) {
        if (!bottle || bottle.state !== 'capped') return;

        bottle.state = 'venting';
        bottle.valveWrap.classList.add('removed');
        bottle.assembly.classList.remove('cap-on');
        bottle.neck.classList.add('open');
        bottle.liquid.classList.add('venting');
        bottle.ventSpray.classList.add('active');
        updateBottleSlotClass(bottle);

        if (!ventPhaseSent) {
            ventPhaseSent = true;
            post('minigamePhase', { phase: 'vent' });
        }

        bottle.ventStart = Date.now();
        bottle.ventInterval = setInterval(() => tickBottleVent(bottle), 50);

        updateEmptyHint();
        updateEmptyStep();
    }

    function tickBottleVent(bottle) {
        if (bottle.state !== 'venting') return;

        const elapsed = Date.now() - bottle.ventStart;
        const progress = Math.min(elapsed / VENT_DURATION, 1);
        const percent = Math.round((1 - progress) * 100);
        const ventPower = Math.max(0.08, 1 - progress);

        bottle.liquid.style.height = `${6 + (1 - progress) * 76}%`;
        bottle.gaugeNeedle.style.transform = `rotate(${60 - progress * 185}deg)`;
        bottle.gaugeValue.textContent = `${percent}%`;
        bottle.ventSpray.style.setProperty('--vent-power', ventPower.toFixed(2));

        if (percent <= 0) {
            bottle.gaugeValue.classList.add('empty');
        }

        if (progress >= 1) {
            finishBottleVent(bottle);
        }
    }

    function finishBottleVent(bottle) {
        if (bottle.ventInterval) {
            clearInterval(bottle.ventInterval);
            bottle.ventInterval = null;
        }

        bottle.state = 'done';
        bottle.done = true;
        bottle.ventSpray.classList.remove('active');
        bottle.ventSpray.style.setProperty('--vent-power', '0');
        bottle.liquid.classList.remove('venting');
        updateBottleSlotClass(bottle);
        updateEmptyHint();
        updateEmptyStep();

        if (allBottlesDone()) {
            completeEmptyMinigame();
        }
    }

    function completeEmptyMinigame() {
        hint.textContent = bottleCount === 1 ? 'Bottle fully emptied!' : 'All bottles fully emptied!';
        post('minigameComplete');
        setTimeout(closeEmptyMinigame, 350);
    }

    function onValvePointerDown(event) {
        if (!minigameActive) return;

        const bottle = findBottleByCap(event.target);
        if (!bottle) return;

        draggingBottle = bottle;
        draggingValve = true;
        valveLastX = event.clientX;
        bottle.valveKnob.classList.add('dragging');
        bottle.valveKnob.setPointerCapture(event.pointerId);
    }

    function onValvePointerMove(event) {
        if (!draggingValve || !draggingBottle) return;

        const bottle = draggingBottle;
        if (bottle.state !== 'capped') return;

        const delta = event.clientX - valveLastX;
        valveLastX = event.clientX;
        bottle.valveOpenedAmount += Math.abs(delta) * VALVE_OPEN_SENSITIVITY;
        bottle.valveShape.style.transform = `rotate(-${bottle.valveOpenedAmount}deg)`;
        bottle.valveProgressFill.style.width = `${Math.min((bottle.valveOpenedAmount / VALVE_OPEN_AMOUNT) * 100, 100)}%`;

        if (bottle.valveOpenedAmount >= VALVE_OPEN_AMOUNT) {
            draggingValve = false;
            draggingBottle = null;
            bottle.valveKnob.classList.remove('dragging');
            startBottleVent(bottle);
        }
    }

    function onValvePointerUp(event) {
        if (!draggingValve) return;

        draggingValve = false;
        if (draggingBottle && draggingBottle.valveKnob) {
            draggingBottle.valveKnob.classList.remove('dragging');
            draggingBottle.valveKnob.releasePointerCapture(event.pointerId);
        }
        draggingBottle = null;
    }

    if (emStage) {
        emStage.addEventListener('pointerdown', onValvePointerDown);
        emStage.addEventListener('pointermove', onValvePointerMove);
        emStage.addEventListener('pointerup', onValvePointerUp);
        emStage.addEventListener('pointercancel', onValvePointerUp);
    }

    window.addEventListener('message', (event) => {
        const { action, data } = event.data || {};
        if (action === 'openEmptyMinigame') {
            const count = Math.min(Math.max(Number(data && data.bottleCount) || 1, 1), 3);
            if (data) {
                if (typeof data.ventDuration === 'number') VENT_DURATION = data.ventDuration;
                if (typeof data.valveOpenAmount === 'number') VALVE_OPEN_AMOUNT = data.valveOpenAmount;
                if (typeof data.valveOpenSensitivity === 'number') VALVE_OPEN_SENSITIVITY = data.valveOpenSensitivity;
            }
            buildEmptyLayout(count);
            openEmptyMinigame();
        }
        if (action === 'closeEmptyMinigame') {
            closeEmptyMinigame();
        }
    });
})();
