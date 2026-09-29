/**
 * ============================================================
 *  TRACKER DE GESTOS — 2 MANOS
 *  Reconocimiento de gestos individuales y combinados usando
 *  MediaPipe Hands con detección de hasta 2 manos simultáneas.
 * ============================================================
 *
 *  Arquitectura:
 *    1. MediaPipe Hands detecta hasta 2 manos (21 landmarks cada una).
 *    2. Para cada mano:
 *       - Se analizan los dedos extendidos.
 *       - Se clasifica el gesto individual.
 *    3. Si hay 2 manos, se intenta clasificar un gesto combinado.
 *    4. Se dibuja el esqueleto de cada mano con color distintivo.
 *    5. Se muestra la información en pantalla.
 *
 *  Colores distintivos:
 *    - Mano 1 (izquierda en pantalla): verde (#00e676)
 *    - Mano 2 (derecha en pantalla): azul (#2196f3)
 */

(function () {
    "use strict";

    // --------------------------------------------------------
    //  Referencias al DOM
    // --------------------------------------------------------
    const videoElement = document.getElementById("camera-video");
    const canvasElement = document.getElementById("overlay-canvas");
    const canvasCtx = canvasElement.getContext("2d");
    const combinedGesturePanel = document.getElementById("combined-gesture-panel");
    const combinedGestureName = document.getElementById("combined-gesture-name");
    const gesturePanel = document.getElementById("gesture-panel");
    const hand1Info = document.getElementById("hand-1-info");
    const hand1Gesture = document.getElementById("hand-1-gesture");
    const hand2Info = document.getElementById("hand-2-info");
    const hand2Gesture = document.getElementById("hand-2-gesture");
    const statusMessage = document.getElementById("status-message");
    const statusText = document.getElementById("status-text");
    const legendItems = document.querySelectorAll(".legend-item");

    // Colores para cada mano
    const HAND_COLORS = ["#00e676", "#2196f3"];

    // --------------------------------------------------------
    //  Estado
    // --------------------------------------------------------
    let lastCombinedGesture = "NINGUNO";

    // --------------------------------------------------------
    //  Funciones auxiliares de UI
    // --------------------------------------------------------
    function showStatus(message) {
        statusText.textContent = message;
        statusMessage.classList.remove("hidden");
    }

    function hideStatus() {
        statusMessage.classList.add("hidden");
    }

    /**
     * Actualiza el panel de gestos individuales.
     *
     * @param {Array} handsData - Array con la info de cada mano detectada.
     */
    function updateHandsUI(handsData) {
        gesturePanel.classList.remove("hidden");

        // Mano 1 (siempre visible si hay al menos una mano)
        hand1Info.classList.remove("hidden");
        hand1Gesture.textContent = handsData[0].gesture.name;

        // Mano 2 (solo si hay dos manos)
        if (handsData.length >= 2) {
            hand2Info.classList.remove("hidden");
            hand2Gesture.textContent = handsData[1].gesture.name;
        } else {
            hand2Info.classList.add("hidden");
        }
    }

    function hideHandsUI() {
        gesturePanel.classList.add("hidden");
    }

    /**
     * Actualiza el panel de gesto combinado.
     *
     * @param {string|null} combinedGesture - Nombre del gesto combinado, o null.
     */
    function updateCombinedUI(combinedGesture) {
        if (combinedGesture && combinedGesture !== "NINGUNO") {
            combinedGestureName.textContent = combinedGesture;
            combinedGesturePanel.classList.remove("hidden");

            if (combinedGesture !== lastCombinedGesture) {
                console.log("[Gesto combinado]", combinedGesture);
                lastCombinedGesture = combinedGesture;
            }
        } else {
            combinedGesturePanel.classList.add("hidden");
            if (lastCombinedGesture !== "NINGUNO") {
                lastCombinedGesture = "NINGUNO";
            }
        }
    }

    /**
     * Resalta en la leyenda los gestos activos.
     *
     * @param {Array} handsData - Info de cada mano.
     * @param {string|null} combinedGesture - Gesto combinado activo.
     */
    function updateLegend(handsData, combinedGesture) {
        // Limpiar todos los resaltados
        legendItems.forEach(function (item) {
            item.classList.remove("active");
        });

        // Resaltar gestos individuales
        handsData.forEach(function (hand) {
            legendItems.forEach(function (item) {
                if (item.textContent.toLowerCase() === hand.gesture.name.toLowerCase()) {
                    item.classList.add("active");
                }
            });
        });

        // Resaltar gesto combinado
        if (combinedGesture && combinedGesture !== "NINGUNO") {
            legendItems.forEach(function (item) {
                const itemText = item.textContent.toLowerCase();
                // Los gestos combinados en la leyenda tienen el formato "Nombre (descripción)"
                if (itemText.startsWith(combinedGesture.toLowerCase())) {
                    item.classList.add("active");
                }
            });
        }
    }

    // --------------------------------------------------------
    //  Utilidades matemáticas
    // --------------------------------------------------------
    function distance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // --------------------------------------------------------
    //  Detección de dedos extendidos
    // --------------------------------------------------------
    /**
     * Determina qué dedos de la mano están extendidos.
     * Funciona sin importar la orientación de la mano.
     *
     * @param {Array} landmarks - 21 puntos de la mano.
     * @param {string} handedness - "Left" o "Right" (lateralidad de la mano).
     * @returns {Array} Array de 5 booleanos: [pulgar, índice, medio, anular, meñique].
     */
    function getExtendedFingers(landmarks, handedness) {
        const fingers = [false, false, false, false, false];
        const WRIST = 0;

        // Dedos: índice, medio, anular, meñique
        // Un dedo está extendido si su punta está más lejos de la muñeca que su PIP.
        const fingerPairs = [
            { tip: 8,  pip: 6  },
            { tip: 12, pip: 10 },
            { tip: 16, pip: 14 },
            { tip: 20, pip: 18 }
        ];

        for (let i = 0; i < fingerPairs.length; i++) {
            const pair = fingerPairs[i];
            const distTip = distance(landmarks[pair.tip], landmarks[WRIST]);
            const distPip = distance(landmarks[pair.pip], landmarks[WRIST]);
            fingers[i + 1] = distTip > distPip;
        }

        // Pulgar: método basado en posición lateral
        const thumbTip = landmarks[4];
        const thumbIp = landmarks[3];
        const indexMcp = landmarks[5];

        let thumbExtended;
        if (handedness === "Right") {
            thumbExtended = thumbTip.x < thumbIp.x;
        } else {
            thumbExtended = thumbTip.x > thumbIp.x;
        }

        // Fallback: si la punta del pulgar está significativamente más lejos
        // de la muñeca que el MCP del índice, consideramos que está extendido.
        const distThumbTip = distance(thumbTip, landmarks[WRIST]);
        const distIndexMcp = distance(indexMcp, landmarks[WRIST]);
        if (distThumbTip > distIndexMcp * 1.1) {
            thumbExtended = true;
        }

        fingers[0] = thumbExtended;

        return fingers;
    }

    // --------------------------------------------------------
    //  Reconocimiento de gestos individuales
    // --------------------------------------------------------
    /**
     * Clasifica el gesto de una mano según qué dedos están extendidos.
     *
     * @param {Array} fingers - Array de 5 booleanos.
     * @param {Array} landmarks - 21 puntos de la mano.
     * @returns {Object} { name, detail }
     */
    function recognizeGesture(fingers, landmarks) {
        const [thumb, index, middle, ring, pinky] = fingers;
        const extendedCount = fingers.filter(Boolean).length;

        const fingerNames = ["pulgar", "índice", "medio", "anular", "meñique"];
        const extendedNames = fingers
            .map((ext, i) => ext ? fingerNames[i] : null)
            .filter(Boolean);
        const detail = extendedNames.length > 0
            ? "Extendidos: " + extendedNames.join(", ")
            : "Ningún dedo extendido";

        // PINZA: pulgar e índice muy juntos, resto extendidos
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const pinchDistance = distance(thumbTip, indexTip);

        if (pinchDistance < 0.05 && middle && ring && pinky) {
            return { name: "PINZA", detail: detail };
        }

        // PUÑO
        if (extendedCount === 0) {
            return { name: "PUÑO", detail: detail };
        }

        // MANO ABIERTA
        if (extendedCount === 5) {
            return { name: "MANO ABIERTA", detail: detail };
        }

        // APUNTAR
        if (index && !middle && !ring && !pinky && !thumb) {
            return { name: "APUNTAR", detail: detail };
        }

        // PAZ
        if (index && middle && !ring && !pinky && !thumb) {
            return { name: "PAZ", detail: detail };
        }

        // TRES
        if (index && middle && ring && !pinky && !thumb) {
            return { name: "TRES", detail: detail };
        }

        // CUATRO
        if (index && middle && ring && pinky && !thumb) {
            return { name: "CUATRO", detail: detail };
        }

        // PULGAR ARRIBA
        if (thumb && !index && !middle && !ring && !pinky) {
            return { name: "PULGAR ARRIBA", detail: detail };
        }

        // CUERNOS
        if (index && !middle && !ring && pinky) {
            return { name: "CUERNOS", detail: detail };
        }

        return { name: "DESCONOCIDO", detail: detail };
    }

    // --------------------------------------------------------
    //  Reconocimiento de gestos combinados (2 manos)
    // --------------------------------------------------------
    /**
     * Clasifica el gesto combinado según los gestos de ambas manos.
     *
     * @param {string} gesture1 - Gesto de la mano 1.
     * @param {string} gesture2 - Gesto de la mano 2.
     * @returns {string|null} Nombre del gesto combinado, o null si no hay.
     */
    function recognizeCombinedGesture(gesture1, gesture2) {
        // Normalizamos para que el orden no importe
        const gestures = [gesture1, gesture2].sort();

        // OCULTAR: ambas manos en puño
        if (gestures[0] === "PUÑO" && gestures[1] === "PUÑO") {
            return "OCULTAR";
        }

        // REVELAR: ambas manos abiertas
        if (gestures[0] === "MANO ABIERTA" && gestures[1] === "MANO ABIERTA") {
            return "REVELAR";
        }

        // TRANSFORMAR: una abierta y otra en puño
        if (gestures[0] === "MANO ABIERTA" && gestures[1] === "PUÑO") {
            return "TRANSFORMAR";
        }

        // UNIR: ambas manos apuntando
        if (gestures[0] === "APUNTAR" && gestures[1] === "APUNTAR") {
            return "UNIR";
        }

        return null;
    }

    // --------------------------------------------------------
    //  Dibujo en el canvas
    // --------------------------------------------------------
    /**
     * Dibuja el esqueleto de una mano y su efecto visual.
     *
     * @param {Array} landmarks - 21 puntos de la mano.
     * @param {string} gesture - Nombre del gesto detectado.
     * @param {number} handIndex - Índice de la mano (0 o 1).
     */
    function drawOverlay(landmarks, gesture, handIndex) {
        const w = canvasElement.width;
        const h = canvasElement.height;
        const color = HAND_COLORS[handIndex];

        // --- Esqueleto (conexiones) ---
        canvasCtx.strokeStyle = color;
        canvasCtx.globalAlpha = 0.6;
        canvasCtx.lineWidth = 2;

        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],
            [0, 5], [5, 6], [6, 7], [7, 8],
            [0, 9], [9, 10], [10, 11], [11, 12],
            [0, 13], [13, 14], [14, 15], [15, 16],
            [0, 17], [17, 18], [18, 19], [19, 20],
            [5, 9], [9, 13], [13, 17]
        ];

        connections.forEach(function (conn) {
            const p1 = landmarks[conn[0]];
            const p2 = landmarks[conn[1]];
            canvasCtx.beginPath();
            canvasCtx.moveTo(p1.x * w, p1.y * h);
            canvasCtx.lineTo(p2.x * w, p2.y * h);
            canvasCtx.stroke();
        });

        // --- Landmarks (puntos) ---
        canvasCtx.globalAlpha = 1.0;
        landmarks.forEach(function (point) {
            canvasCtx.beginPath();
            canvasCtx.arc(point.x * w, point.y * h, 4, 0, 2 * Math.PI);
            canvasCtx.fillStyle = color;
            canvasCtx.fill();
        });

        // --- Efecto visual del gesto ---
        drawGestureEffect(landmarks, gesture, w, h, color);
    }

    /**
     * Dibuja un efecto visual según el gesto detectado.
     *
     * @param {Array} landmarks - 21 puntos de la mano.
     * @param {string} gesture - Nombre del gesto.
     * @param {number} w - Ancho del canvas.
     * @param {number} h - Alto del canvas.
     * @param {string} color - Color base para el efecto.
     */
    function drawGestureEffect(landmarks, gesture, w, h, color) {
        canvasCtx.save();

        switch (gesture) {
            case "APUNTAR": {
                const tip = landmarks[8];
                const x = tip.x * w;
                const y = tip.y * h;
                canvasCtx.beginPath();
                canvasCtx.arc(x, y, 25, 0, 2 * Math.PI);
                canvasCtx.strokeStyle = "#ff0000";
                canvasCtx.lineWidth = 4;
                canvasCtx.stroke();
                canvasCtx.fillStyle = "rgba(255, 0, 0, 0.3)";
                canvasCtx.fill();
                break;
            }

            case "PUÑO": {
                const palm = landmarks[9];
                const x = palm.x * w;
                const y = palm.y * h;
                const size = 60;
                canvasCtx.strokeStyle = "#ffeb3b";
                canvasCtx.lineWidth = 4;
                canvasCtx.strokeRect(x - size / 2, y - size / 2, size, size);
                canvasCtx.fillStyle = "rgba(255, 235, 59, 0.2)";
                canvasCtx.fillRect(x - size / 2, y - size / 2, size, size);
                break;
            }

            case "MANO ABIERTA": {
                const palm = landmarks[9];
                const x = palm.x * w;
                const y = palm.y * h;
                drawStar(x, y, 5, 30, 15, color);
                break;
            }

            case "PAZ": {
                const tipIndex = landmarks[8];
                const tipMiddle = landmarks[12];
                canvasCtx.beginPath();
                canvasCtx.moveTo(tipIndex.x * w, tipIndex.y * h);
                canvasCtx.lineTo(tipMiddle.x * w, tipMiddle.y * h);
                canvasCtx.strokeStyle = "#2196f3";
                canvasCtx.lineWidth = 6;
                canvasCtx.stroke();
                break;
            }

            case "PINZA": {
                const tipThumb = landmarks[4];
                const tipIndex = landmarks[8];
                const x = ((tipThumb.x + tipIndex.x) / 2) * w;
                const y = ((tipThumb.y + tipIndex.y) / 2) * h;
                canvasCtx.beginPath();
                canvasCtx.arc(x, y, 15, 0, 2 * Math.PI);
                canvasCtx.strokeStyle = "#ff9800";
                canvasCtx.lineWidth = 4;
                canvasCtx.stroke();
                canvasCtx.fillStyle = "rgba(255, 152, 0, 0.4)";
                canvasCtx.fill();
                break;
            }

            case "PULGAR ARRIBA": {
                const tip = landmarks[4];
                const x = tip.x * w;
                const y = tip.y * h;
                canvasCtx.beginPath();
                canvasCtx.moveTo(x, y - 30);
                canvasCtx.lineTo(x - 15, y - 10);
                canvasCtx.lineTo(x + 15, y - 10);
                canvasCtx.closePath();
                canvasCtx.fillStyle = color;
                canvasCtx.fill();
                break;
            }

            case "CUERNOS": {
                const tipIndex = landmarks[8];
                const tipPinky = landmarks[20];
                [tipIndex, tipPinky].forEach(function (tip) {
                    canvasCtx.beginPath();
                    canvasCtx.arc(tip.x * w, tip.y * h, 20, 0, 2 * Math.PI);
                    canvasCtx.strokeStyle = "#9c27b0";
                    canvasCtx.lineWidth = 4;
                    canvasCtx.stroke();
                });
                break;
            }

            case "TRES":
            case "CUATRO": {
                const fingerTips = [8, 12, 16, 20];
                const fingers = getExtendedFingers(landmarks, "Right");
                fingerTips.forEach(function (tipIdx, i) {
                    if (fingers[i + 1]) {
                        const tip = landmarks[tipIdx];
                        canvasCtx.beginPath();
                        canvasCtx.arc(tip.x * w, tip.y * h, 18, 0, 2 * Math.PI);
                        canvasCtx.strokeStyle = "#00bcd4";
                        canvasCtx.lineWidth = 3;
                        canvasCtx.stroke();
                    }
                });
                break;
            }

            default:
                break;
        }

        canvasCtx.restore();
    }

    function drawStar(cx, cy, spikes, outerRadius, innerRadius, color) {
        let rot = (Math.PI / 2) * 3;
        const step = Math.PI / spikes;

        canvasCtx.beginPath();
        canvasCtx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            let x = cx + Math.cos(rot) * outerRadius;
            let y = cy + Math.sin(rot) * outerRadius;
            canvasCtx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            canvasCtx.lineTo(x, y);
            rot += step;
        }
        canvasCtx.lineTo(cx, cy - outerRadius);
        canvasCtx.closePath();
        canvasCtx.fillStyle = color;
        canvasCtx.fill();
        canvasCtx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        canvasCtx.lineWidth = 2;
        canvasCtx.stroke();
    }

    // --------------------------------------------------------
    //  Callback de MediaPipe: se ejecuta en cada frame
    // --------------------------------------------------------
    /**
     * Recibe los resultados de MediaPipe, procesa cada mano detectada,
     * clasifica gestos individuales y combinados, y actualiza la UI.
     *
     * @param {Object} results - Resultados de MediaPipe Hands.
     */
    function onResults(results) {
        // Ajustar el tamaño del canvas al del vídeo
        if (canvasElement.width !== videoElement.videoWidth) {
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
        }

        // Limpiar el canvas
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        // Si no hay manos, ocultamos todo
        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            hideHandsUI();
            updateCombinedUI(null);
            updateLegend([], null);
            return;
        }

        // Procesamos cada mano detectada
        const handsData = [];

        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            const handedness = results.multiHandedness[i].label;

            // Detectamos dedos extendidos
            const fingers = getExtendedFingers(landmarks, handedness);

            // Clasificamos el gesto individual
            const gesture = recognizeGesture(fingers, landmarks);

            handsData.push({
                landmarks: landmarks,
                handedness: handedness,
                fingers: fingers,
                gesture: gesture
            });
        }

        // Ordenamos las manos por posición X de la muñeca
        // para que "Mano 1" sea siempre la de la izquierda en pantalla
        // y "Mano 2" la de la derecha. Esto es consistente para el usuario.
        handsData.sort(function (a, b) {
            return a.landmarks[0].x - b.landmarks[0].x;
        });

        // Detectamos gesto combinado si hay 2 manos
        let combinedGesture = null;
        if (handsData.length === 2) {
            combinedGesture = recognizeCombinedGesture(
                handsData[0].gesture.name,
                handsData[1].gesture.name
            );
        }

        // Actualizamos la UI
        updateHandsUI(handsData);
        updateCombinedUI(combinedGesture);
        updateLegend(handsData, combinedGesture);

        // Dibujamos el overlay de cada mano
        for (let i = 0; i < handsData.length; i++) {
            drawOverlay(handsData[i].landmarks, handsData[i].gesture.name, i);
        }

        // Log en consola si cambió algún gesto
        const gestureSummary = handsData.map(h => h.gesture.name).join(" + ");
        const fullSummary = combinedGesture ? combinedGesture + " (" + gestureSummary + ")" : gestureSummary;
        if (fullSummary !== lastCombinedGesture) {
            console.log("[Gestos]", fullSummary);
        }
    }

    // --------------------------------------------------------
    //  Inicialización de MediaPipe Hands
    // --------------------------------------------------------
    async function startHandTracking() {
        showStatus("Cargando modelo de detección de manos...");

        try {
            const hands = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                }
            });

            // CAMBIO CLAVE: maxNumHands a 2
            hands.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.5
            });

            hands.onResults(onResults);

            showStatus("Iniciando cámara...");
            const camera = new Camera(videoElement, {
                onFrame: async () => {
                    await hands.send({ image: videoElement });
                },
                width: 1280,
                height: 720
            });

            await camera.start();

            hideStatus();
            console.log("[Tracker] Sistema listo. Detecta hasta 2 manos.");

        } catch (error) {
            console.error("[Tracker] Error:", error);
            showStatus("Error al iniciar: " + error.message);
        }
    }

    // --------------------------------------------------------
    //  Arranque
    // --------------------------------------------------------
    window.addEventListener("load", function () {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showStatus("Tu navegador no soporta acceso a la cámara.");
            return;
        }

        if (typeof Hands === "undefined") {
            showStatus("Error: MediaPipe Hands no se ha cargado.");
            return;
        }

        startHandTracking();
    });

})();