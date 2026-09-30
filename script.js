/**
 * ============================================================
 *  TRACKER DE GESTOS — INTERFAZ LIMPIA
 *  Detecta hasta 2 manos, reconoce gestos individuales y
 *  combinados, y muestra solo el nombre del gesto en pantalla.
 * ============================================================
 *
 *  Cambios respecto a la versión anterior:
 *    - Se eliminó el panel complejo con cajas y bordes.
 *    - Se eliminó la leyenda de gestos.
 *    - Ahora solo se muestra un texto simple con el nombre del gesto.
 *    - Si hay gesto combinado, se muestra ese. Si no, se muestran
 *      los gestos individuales separados por " + ".
 *
 *  Ejemplos de lo que se muestra:
 *    - "APUNTAR" (una mano)
 *    - "PUÑO + MANO ABIERTA" (dos manos, gesto individual)
 *    - "TRANSFORMAR" (dos manos, gesto combinado)
 */

(function () {
    "use strict";

    // --------------------------------------------------------
    //  Referencias al DOM
    // --------------------------------------------------------
    const videoElement = document.getElementById("camera-video");
    const canvasElement = document.getElementById("overlay-canvas");
    const canvasCtx = canvasElement.getContext("2d");
    const gestureText = document.getElementById("gesture-text");
    const gestureName = document.getElementById("gesture-name");
    const statusMessage = document.getElementById("status-message");
    const statusText = document.getElementById("status-text");

    // Colores para cada mano (verde y azul)
    const HAND_COLORS = ["#00e676", "#2196f3"];

    // --------------------------------------------------------
    //  Estado
    // --------------------------------------------------------
    let lastGestureDisplay = "";

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
     * Actualiza el texto del gesto en pantalla.
     *
     * @param {string} displayText - Texto a mostrar.
     */
    function updateGestureDisplay(displayText) {
        if (displayText !== lastGestureDisplay) {
            gestureName.textContent = displayText;
            gestureText.classList.remove("hidden");
            lastGestureDisplay = displayText;
            console.log("[Gesto]", displayText);
        }
    }

    function hideGestureDisplay() {
        gestureText.classList.add("hidden");
        if (lastGestureDisplay !== "") {
            lastGestureDisplay = "";
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
     * @param {string} handedness - "Left" o "Right".
     * @returns {Array} Array de 5 booleanos: [pulgar, índice, medio, anular, meñique].
     */
    function getExtendedFingers(landmarks, handedness) {
        const fingers = [false, false, false, false, false];
        const WRIST = 0;

        // Dedos: índice, medio, anular, meñique
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

        // Pulgar
        const thumbTip = landmarks[4];
        const thumbIp = landmarks[3];
        const indexMcp = landmarks[5];

        let thumbExtended;
        if (handedness === "Right") {
            thumbExtended = thumbTip.x < thumbIp.x;
        } else {
            thumbExtended = thumbTip.x > thumbIp.x;
        }

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
    function recognizeGesture(fingers, landmarks) {
        const [thumb, index, middle, ring, pinky] = fingers;
        const extendedCount = fingers.filter(Boolean).length;

        // PINZA
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const pinchDistance = distance(thumbTip, indexTip);

        if (pinchDistance < 0.05 && middle && ring && pinky) {
            return { name: "PINZA" };
        }

        // PUÑO
        if (extendedCount === 0) {
            return { name: "PUÑO" };
        }

        // MANO ABIERTA
        if (extendedCount === 5) {
            return { name: "MANO ABIERTA" };
        }

        // APUNTAR
        if (index && !middle && !ring && !pinky && !thumb) {
            return { name: "APUNTAR" };
        }

        // PAZ
        if (index && middle && !ring && !pinky && !thumb) {
            return { name: "PAZ" };
        }

        // TRES
        if (index && middle && ring && !pinky && !thumb) {
            return { name: "TRES" };
        }

        // CUATRO
        if (index && middle && ring && pinky && !thumb) {
            return { name: "CUATRO" };
        }

        // PULGAR ARRIBA
        if (thumb && !index && !middle && !ring && !pinky) {
            return { name: "PULGAR ARRIBA" };
        }

        // CUERNOS
        if (index && !middle && !ring && pinky) {
            return { name: "CUERNOS" };
        }

        return { name: "DESCONOCIDO" };
    }

    // --------------------------------------------------------
    //  Reconocimiento de gestos combinados (2 manos)
    // --------------------------------------------------------
    function recognizeCombinedGesture(gesture1, gesture2) {
        const gestures = [gesture1, gesture2].sort();

        if (gestures[0] === "PUÑO" && gestures[1] === "PUÑO") {
            return "OCULTAR";
        }

        if (gestures[0] === "MANO ABIERTA" && gestures[1] === "MANO ABIERTA") {
            return "REVELAR";
        }

        if (gestures[0] === "MANO ABIERTA" && gestures[1] === "PUÑO") {
            return "TRANSFORMAR";
        }

        if (gestures[0] === "APUNTAR" && gestures[1] === "APUNTAR") {
            return "UNIR";
        }

        return null;
    }

    // --------------------------------------------------------
    //  Dibujo en el canvas
    // --------------------------------------------------------
    function drawOverlay(landmarks, gesture, handIndex) {
        const w = canvasElement.width;
        const h = canvasElement.height;
        const color = HAND_COLORS[handIndex];

        // Esqueleto
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

        // Landmarks
        canvasCtx.globalAlpha = 1.0;
        landmarks.forEach(function (point) {
            canvasCtx.beginPath();
            canvasCtx.arc(point.x * w, point.y * h, 4, 0, 2 * Math.PI);
            canvasCtx.fillStyle = color;
            canvasCtx.fill();
        });

        // Efecto visual del gesto
        drawGestureEffect(landmarks, gesture, w, h, color);
    }

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
    //  Callback de MediaPipe
    // --------------------------------------------------------
    function onResults(results) {
        if (canvasElement.width !== videoElement.videoWidth) {
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
        }

        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            hideGestureDisplay();
            return;
        }

        const handsData = [];

        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            const handedness = results.multiHandedness[i].label;
            const fingers = getExtendedFingers(landmarks, handedness);
            const gesture = recognizeGesture(fingers, landmarks);

            handsData.push({
                landmarks: landmarks,
                handedness: handedness,
                fingers: fingers,
                gesture: gesture
            });
        }

        // Ordenar por posición X para consistencia
        handsData.sort(function (a, b) {
            return a.landmarks[0].x - b.landmarks[0].x;
        });

        // Detectar gesto combinado
        let combinedGesture = null;
        if (handsData.length === 2) {
            combinedGesture = recognizeCombinedGesture(
                handsData[0].gesture.name,
                handsData[1].gesture.name
            );
        }

        // Construir el texto a mostrar
        let displayText;
        if (combinedGesture) {
            displayText = combinedGesture;
        } else if (handsData.length === 1) {
            displayText = handsData[0].gesture.name;
        } else {
            displayText = handsData[0].gesture.name + " + " + handsData[1].gesture.name;
        }

        updateGestureDisplay(displayText);

        // Dibujar overlay de cada mano
        for (let i = 0; i < handsData.length; i++) {
            drawOverlay(handsData[i].landmarks, handsData[i].gesture.name, i);
        }
    }

    // --------------------------------------------------------
    //  Inicialización
    // --------------------------------------------------------
    async function startHandTracking() {
        showStatus("Cargando modelo de detección de manos...");

        try {
            const hands = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                }
            });

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
            console.log("[Tracker] Sistema listo.");

        } catch (error) {
            console.error("[Tracker] Error:", error);
            showStatus("Error al iniciar: " + error.message);
        }
    }

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