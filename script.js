/**
 * ============================================================
 *  TRACKER DE GESTOS DE LA MANO
 *  Reconocimiento de múltiples gestos usando MediaPipe Hands.
 * ============================================================
 *
 *  Arquitectura:
 *    1. MediaPipe Hands detecta 21 landmarks de la mano.
 *    2. getExtendedFingers() analiza qué dedos están extendidos.
 *    3. recognizeGesture() clasifica el gesto según la combinación.
 *    4. Se dibuja en pantalla el resultado.
 *
 *  Landmarks de MediaPipe Hands (21 puntos):
 *    0  : muñeca
 *    1  : base del pulgar (CMC)
 *    2  : articulación media del pulgar (MCP)
 *    3  : articulación intermedia del pulgar (IP)
 *    4  : punta del pulgar
 *    5  : base del índice (MCP)
 *    6  : articulación media del índice (PIP)
 *    7  : articulación distal del índice (DIP)
 *    8  : punta del índice
 *    9  : base del medio (MCP)
 *    10 : articulación media del medio (PIP)
 *    11 : articulación distal del medio (DIP)
 *    12 : punta del medio
 *    13 : base del anular (MCP)
 *    14 : articulación media del anular (PIP)
 *    15 : articulación distal del anular (DIP)
 *    16 : punta del anular
 *    17 : base del meñique (MCP)
 *    18 : articulación media del meñique (PIP)
 *    19 : articulación distal del meñique (DIP)
 *    20 : punta del meñique
 */

(function () {
    "use strict";

    // --------------------------------------------------------
    //  Referencias al DOM
    // --------------------------------------------------------
    const videoElement = document.getElementById("camera-video");
    const canvasElement = document.getElementById("overlay-canvas");
    const canvasCtx = canvasElement.getContext("2d");
    const gesturePanel = document.getElementById("gesture-panel");
    const gestureName = document.getElementById("gesture-name");
    const gestureDetail = document.getElementById("gesture-detail");
    const statusMessage = document.getElementById("status-message");
    const statusText = document.getElementById("status-text");
    const legendItems = document.querySelectorAll(".legend-item");

    // --------------------------------------------------------
    //  Estado
    // --------------------------------------------------------
    let currentGesture = "NINGUNO";
    let lastGesture = "NINGUNO";

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
     * Actualiza el panel del gesto y resalta el elemento
     * correspondiente en la leyenda.
     *
     * @param {string} gestureNameText - Nombre del gesto.
     * @param {string} detail - Detalle adicional (dedos extendidos).
     */
    function updateGestureUI(gestureNameText, detail) {
        gestureName.textContent = gestureNameText;
        gestureDetail.textContent = detail;
        gesturePanel.classList.remove("hidden");

        // Resaltar en la leyenda el gesto activo
        legendItems.forEach(function (item) {
            if (item.textContent.toLowerCase() === gestureNameText.toLowerCase()) {
                item.classList.add("active");
            } else {
                item.classList.remove("active");
            }
        });
    }

    function hideGestureUI() {
        gesturePanel.classList.add("hidden");
        legendItems.forEach(function (item) {
            item.classList.remove("active");
        });
    }

    // --------------------------------------------------------
    //  Utilidades matemáticas
    // --------------------------------------------------------
    /**
     * Calcula la distancia euclídea entre dos puntos.
     * Cada punto tiene coordenadas x, y (normalizadas entre 0 y 1).
     *
     * @param {Object} p1 - Primer punto {x, y}.
     * @param {Object} p2 - Segundo punto {x, y}.
     * @returns {number} Distancia.
     */
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
     *
     * Método para los cuatro dedos (índice, medio, anular, meñique):
     *   Un dedo está extendido si su punta está más lejos de la muñeca
     *   que su articulación PIP. Esto funciona sin importar la
     *   orientación de la mano.
     *
     * Método para el pulgar:
     *   Comparamos la distancia horizontal de la punta del pulgar
     *   respecto a la articulación IP, en relación con el dedo índice.
     *   Esto funciona tanto con palma hacia la cámara como dorso.
     *
     * @param {Array} landmarks - 21 puntos de la mano.
     * @param {string} handedness - "Left" o "Right" (mano detectada).
     * @returns {Array} Array de 5 booleanos:
     *                  [pulgar, índice, medio, anular, meñique].
     */
    function getExtendedFingers(landmarks, handedness) {
        const fingers = [false, false, false, false, false];

        // Índices de los landmarks
        const WRIST = 0;

        // --- Dedos: índice, medio, anular, meñique ---
        // Para cada dedo comparamos la punta con la articulación PIP.
        // Si la punta está más lejos de la muñeca que el PIP, está extendido.
        const fingerPairs = [
            { tip: 8,  pip: 6  }, // índice
            { tip: 12, pip: 10 }, // medio
            { tip: 16, pip: 14 }, // anular
            { tip: 20, pip: 18 }  // meñique
        ];

        for (let i = 0; i < fingerPairs.length; i++) {
            const pair = fingerPairs[i];
            const distTip = distance(landmarks[pair.tip], landmarks[WRIST]);
            const distPip = distance(landmarks[pair.pip], landmarks[WRIST]);
            fingers[i + 1] = distTip > distPip;
        }

        // --- Pulgar ---
        // El pulgar se mueve lateralmente, no verticalmente como los otros.
        // Comparamos la posición X de la punta del pulgar (4) respecto
        // a su articulación IP (3), teniendo en cuenta si es mano
        // izquierda o derecha.
        const thumbTip = landmarks[4];
        const thumbIp = landmarks[3];
        const thumbMcp = landmarks[2];
        const indexMcp = landmarks[5];

        // Determinamos la dirección "hacia fuera" de la mano
        // según si es izquierda o derecha.
        // Nota: MediaPipe devuelve la mano desde su perspectiva,
        // que es la inversa de la nuestra (por el efecto espejo).
        let thumbExtended;
        if (handedness === "Right") {
            // Mano derecha: el pulgar apunta a la derecha de la imagen
            thumbExtended = thumbTip.x < thumbIp.x;
        } else {
            // Mano izquierda: el pulgar apunta a la izquierda
            thumbExtended = thumbTip.x > thumbIp.x;
        }

        // Comprobación adicional: si el pulgar está claramente
        // más lejos de la muñeca que el MCP del índice, está extendido.
        const distThumbTip = distance(thumbTip, landmarks[WRIST]);
        const distIndexMcp = distance(indexMcp, landmarks[WRIST]);
        if (distThumbTip > distIndexMcp * 1.1) {
            thumbExtended = true;
        }

        fingers[0] = thumbExtended;

        return fingers;
    }

    // --------------------------------------------------------
    //  Reconocimiento del gesto
    // --------------------------------------------------------
    /**
     * Clasifica el gesto según qué dedos están extendidos.
     *
     * @param {Array} fingers - Array de 5 booleanos.
     * @param {Array} landmarks - 21 puntos de la mano (para gestos
     *                             que necesitan posición relativa,
     *                             como la pinza).
     * @returns {Object} { name, detail } con el nombre del gesto
     *                   y una descripción de los dedos extendidos.
     */
    function recognizeGesture(fingers, landmarks) {
        const [thumb, index, middle, ring, pinky] = fingers;

        // Contamos cuántos dedos están extendidos
        const extendedCount = fingers.filter(Boolean).length;

        // Descripción para el detalle
        const fingerNames = ["pulgar", "índice", "medio", "anular", "meñique"];
        const extendedNames = fingers
            .map((ext, i) => ext ? fingerNames[i] : null)
            .filter(Boolean);
        const detail = extendedNames.length > 0
            ? "Extendidos: " + extendedNames.join(", ")
            : "Ningún dedo extendido";

        // --- Reglas de clasificación ---
        // El orden importa: las reglas más específicas van primero.

        // PINZA: pulgar e índice muy juntos, resto extendidos
        // Detectamos si la punta del pulgar (4) y la del índice (8)
        // están muy cerca una de la otra.
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const pinchDistance = distance(thumbTip, indexTip);

        if (pinchDistance < 0.05 && middle && ring && pinky) {
            return { name: "PINZA", detail: detail };
        }

        // PUÑO: ningún dedo extendido
        if (extendedCount === 0) {
            return { name: "PUÑO", detail: detail };
        }

        // MANO ABIERTA: todos los dedos extendidos
        if (extendedCount === 5) {
            return { name: "MANO ABIERTA", detail: detail };
        }

        // APUNTAR: solo índice extendido
        if (index && !middle && !ring && !pinky && !thumb) {
            return { name: "APUNTAR", detail: detail };
        }

        // PAZ: índice y medio extendidos, resto cerrados
        if (index && middle && !ring && !pinky && !thumb) {
            return { name: "PAZ", detail: detail };
        }

        // TRES: índice, medio y anular extendidos
        if (index && middle && ring && !pinky && !thumb) {
            return { name: "TRES", detail: detail };
        }

        // CUATRO: todos menos el pulgar
        if (index && middle && ring && pinky && !thumb) {
            return { name: "CUATRO", detail: detail };
        }

        // PULGAR ARRIBA: solo pulgar extendido
        if (thumb && !index && !middle && !ring && !pinky) {
            return { name: "PULGAR ARRIBA", detail: detail };
        }

        // CUERNOS: índice y meñique extendidos, resto cerrados
        if (index && !middle && !ring && pinky) {
            return { name: "CUERNOS", detail: detail };
        }

        // Si no coincide con ningún gesto conocido
        return { name: "DESCONOCIDO", detail: detail };
    }

    // --------------------------------------------------------
    //  Dibujo en el canvas
    // --------------------------------------------------------
    /**
     * Dibuja los landmarks de la mano y un efecto visual
     * según el gesto detectado.
     *
     * @param {Array} landmarks - 21 puntos de la mano.
     * @param {string} gesture - Nombre del gesto detectado.
     */
    function drawOverlay(landmarks, gesture) {
        // Limpiamos el canvas
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        // Convertimos las coordenadas normalizadas a píxeles
        const w = canvasElement.width;
        const h = canvasElement.height;

        // --- Dibujar conexiones entre landmarks (esqueleto) ---
        canvasCtx.strokeStyle = "rgba(0, 230, 118, 0.6)";
        canvasCtx.lineWidth = 2;

        // Conexiones de los dedos (definidas por MediaPipe)
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],       // pulgar
            [0, 5], [5, 6], [6, 7], [7, 8],       // índice
            [0, 9], [9, 10], [10, 11], [11, 12],  // medio
            [0, 13], [13, 14], [14, 15], [15, 16], // anular
            [0, 17], [17, 18], [18, 19], [19, 20], // meñique
            [5, 9], [9, 13], [13, 17]              // palma
        ];

        connections.forEach(function (conn) {
            const p1 = landmarks[conn[0]];
            const p2 = landmarks[conn[1]];
            canvasCtx.beginPath();
            canvasCtx.moveTo(p1.x * w, p1.y * h);
            canvasCtx.lineTo(p2.x * w, p2.y * h);
            canvasCtx.stroke();
        });

        // --- Dibujar los landmarks (puntos) ---
        landmarks.forEach(function (point) {
            canvasCtx.beginPath();
            canvasCtx.arc(point.x * w, point.y * h, 4, 0, 2 * Math.PI);
            canvasCtx.fillStyle = "#00e676";
            canvasCtx.fill();
        });

        // --- Efecto visual según el gesto ---
        drawGestureEffect(landmarks, gesture, w, h);
    }

    /**
     * Dibuja un efecto visual diferente según el gesto detectado.
     * Esto es lo que después sustituiremos por imágenes de cartas,
     * objetos, etc., en el proyecto final.
     *
     * @param {Array} landmarks - 21 puntos de la mano.
     * @param {string} gesture - Nombre del gesto.
     * @param {number} w - Ancho del canvas.
     * @param {number} h - Alto del canvas.
     */
    function drawGestureEffect(landmarks, gesture, w, h) {
        canvasCtx.save();

        switch (gesture) {
            case "APUNTAR": {
                // Círculo rojo en la punta del índice
                const tip = landmarks[8];
                const x = tip.x * w;
                const y = tip.y * h;
                canvasCtx.beginPath();
                canvasCtx.arc(x, y, 5, 0, 2 * Math.PI);
                canvasCtx.strokeStyle = "#ff0000";
                canvasCtx.lineWidth = 4;
                canvasCtx.stroke();
                canvasCtx.fillStyle = "rgba(255, 0, 0, 0.3)";
                canvasCtx.fill();
                break;
            }

            case "PUÑO": {
                // Cuadrado amarillo en el centro de la palma
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
                // Estrella verde en el centro de la palma
                const palm = landmarks[9];
                const x = palm.x * w;
                const y = palm.y * h;
                drawStar(x, y, 5, 30, 15, "#00e676");
                break;
            }

            case "PAZ": {
                // Línea entre las puntas del índice y medio
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
                // Círculo pequeño entre pulgar e índice
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
                // Flecha verde sobre la punta del pulgar
                const tip = landmarks[4];
                const x = tip.x * w;
                const y = tip.y * h;
                canvasCtx.beginPath();
                canvasCtx.moveTo(x, y - 30);
                canvasCtx.lineTo(x - 15, y - 10);
                canvasCtx.lineTo(x + 15, y - 10);
                canvasCtx.closePath();
                canvasCtx.fillStyle = "#00e676";
                canvasCtx.fill();
                break;
            }

            case "CUERNOS": {
                // Dos círculos en las puntas de índice y meñique
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
                // Círculos en las puntas de los dedos extendidos
                const fingerTips = [8, 12, 16, 20]; // índice, medio, anular, meñique
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
                // Sin efecto para gestos desconocidos
                break;
        }

        canvasCtx.restore();
    }

    /**
     * Dibuja una estrella de N puntas.
     *
     * @param {number} cx - Centro X.
     * @param {number} cy - Centro Y.
     * @param {number} spikes - Número de puntas.
     * @param {number} outerRadius - Radio exterior.
     * @param {number} innerRadius - Radio interior.
     * @param {string} color - Color de relleno.
     */
    function drawStar(cx, cy, spikes, outerRadius, innerRadius, color) {
        let rot = (Math.PI / 2) * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;

        canvasCtx.beginPath();
        canvasCtx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
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
     * Recibe los resultados de MediaPipe, detecta el gesto
     * y actualiza la interfaz.
     *
     * @param {Object} results - Resultados de MediaPipe Hands.
     */
    function onResults(results) {
        // Ajustar el tamaño del canvas al del vídeo
        if (canvasElement.width !== videoElement.videoWidth) {
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
        }

        // Si no hay manos, limpiamos todo
        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            hideGestureUI();
            currentGesture = "NINGUNO";
            return;
        }

        // Tomamos la primera mano detectada
        const landmarks = results.multiHandLandmarks[0];
        // MediaPipe devuelve la lateralidad de la mano
        // (desde su perspectiva, que es la inversa de la nuestra)
        const handedness = results.multiHandedness[0].label;

        // Detectamos qué dedos están extendidos
        const fingers = getExtendedFingers(landmarks, handedness);

        // Clasificamos el gesto
        const gesture = recognizeGesture(fingers, landmarks);
        currentGesture = gesture.name;

        // Solo actualizamos la UI si el gesto ha cambiado
        // (evita parpadeos)
        if (currentGesture !== lastGesture) {
            console.log("[Gesto]", currentGesture, "-", gesture.detail);
            lastGesture = currentGesture;
        }

        // Actualizamos la interfaz
        if (currentGesture === "DESCONOCIDO" || currentGesture === "NINGUNO") {
            hideGestureUI();
        } else {
            updateGestureUI(currentGesture, gesture.detail);
        }

        // Dibujamos el overlay
        drawOverlay(landmarks, currentGesture);
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

            hands.setOptions({
                maxNumHands: 1,
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
            console.log("[Tracker] Sistema listo. Prueba los gestos de la leyenda.");

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