document.getElementById('startButton').addEventListener('click', startGeneration);
document.getElementById('exportButton').addEventListener('click', exportAudio);

let generatedAudioBuffer = null; // To store the generated audio for exporting

function startGeneration() {
    console.log('Start Generation button clicked');
    const key = document.getElementById('key').value;
    const scaleType = document.getElementById('scaleType').value; // Retrieve scale type
    const bpm = parseInt(document.getElementById('bpm').value);
    const duration = parseInt(document.getElementById('duration').value) * 1000; // in milliseconds

    console.log(`Key: ${key}, Scale Type: ${scaleType}, BPM: ${bpm}, Duration: ${duration}ms`);

    // Initialize Audio Context
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Define musical key and scale type
    let scale = getScale(key, scaleType);

    // State variables
    let startTime = audioCtx.currentTime;
    let currentTime = startTime;
    const endTime = startTime + duration / 1000;
    const noteInterval = 60 / bpm; // seconds per beat

    // Previous notes storage
    const previousNotes = [];

    // Array to hold scheduled notes for visualization and exporting
    const scheduledNotes = [];

    // Function to schedule notes
    function scheduleNotes() {
        while (currentTime < endTime) {
            // Generate quantum elements
            const quantumElements = generateQuantumElements(previousNotes);

            // Map to musical parameters
            const note = mapQuantumToNote(quantumElements, scale, previousNotes);

            // Schedule the note
            playNote(audioCtx, note, currentTime, noteInterval);

            // Store the note for exporting and visualization
            scheduledNotes.push({ 
                ...note, 
                position: quantumElements.position, 
                momentum: quantumElements.momentum, 
                spin: quantumElements.spin, // <-- Added spin here
                startTime: currentTime, 
                duration: noteInterval 
            });

            // Log the scheduled note with position and momentum
            console.log(`Scheduled Note: Pitch=${note.pitch}, Position=${quantumElements.position.toFixed(4)}, Momentum=${quantumElements.momentum.toFixed(4)}, Spin=${quantumElements.spin}`);

            // Update state
            previousNotes.push(note);
            currentTime += noteInterval;

            // Optionally change key with a small probability
            if (Math.random() < 0.01) { // 1% chance
                const newKey = getRandomKey();
                console.log(`Changing key to ${newKey}`);
                scale = getScale(newKey, scaleType);
            }
        }

        // After scheduling, visualize the wave function
        visualizeWaveFunction(scheduledNotes);

        // Store the generated audio for exporting
        generatedAudioBuffer = scheduledNotes;
    }

    scheduleNotes();
}

function exportAudio() {
    if (!generatedAudioBuffer || generatedAudioBuffer.length === 0) {
        alert('No audio generated to export!');
        return;
    }

    const key = document.getElementById('key').value;
    const scaleType = document.getElementById('scaleType').value;
    const bpm = parseInt(document.getElementById('bpm').value);
    const duration = parseInt(document.getElementById('duration').value) * 1000; // in milliseconds

    // Initialize OfflineAudioContext
    const sampleRate = 44100;
    const offlineCtx = new OfflineAudioContext(2, sampleRate * (duration / 1000), sampleRate);

    // Define musical key and scale type
    const scale = getScale(key, scaleType);

    // Function to play a note in OfflineAudioContext
    function playNoteOffline(offlineCtx, note, startTime, duration) {
        const oscillator = offlineCtx.createOscillator();
        const gainNode = offlineCtx.createGain();

        // Set oscillator type based on timbre
        oscillator.type = note.timbre;

        // Set frequency based on pitch
        oscillator.frequency.value = noteToFrequency(note.pitch);

        // Set volume based on velocity
        gainNode.gain.value = note.velocity;

        oscillator.connect(gainNode);
        gainNode.connect(offlineCtx.destination);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
    }

    // Schedule all notes in OfflineAudioContext
    generatedAudioBuffer.forEach(note => {
        playNoteOffline(offlineCtx, note, note.startTime, note.duration);
    });

    // Render the audio
    offlineCtx.startRendering().then(renderedBuffer => {
        // Convert the AudioBuffer to WAV
        const wavData = bufferToWave(renderedBuffer, renderedBuffer.length);
        const blob = new Blob([wavData], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);

        // Create a download link
        const link = document.createElement('a');
        link.href = url;
        link.download = 'quantum_music.wav';
        link.textContent = 'Download Generated Audio';
        link.style.display = 'block';
        link.style.marginTop = '10px';
        document.body.appendChild(link);
    }).catch(err => {
        console.error('Rendering failed: ' + err);
    });
}

// Helper function to convert AudioBuffer to WAV
function bufferToWave(abuffer, len) {
    const numOfChan = abuffer.numberOfChannels;
    const length = len * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let i, sample, offset = 0, pos = 0;

    // Write WAVE header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit (hardcoded in this demo)

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    // Write interleaved data
    for(i = 0; i < abuffer.numberOfChannels; i++) {
        channels.push(abuffer.getChannelData(i));
    }

    while(pos < length) {
        for(i = 0; i < numOfChan; i++) { // interleave channels
            sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
            sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF); // convert to 16-bit
            view.setInt16(pos, sample, true); // little endian
            pos += 2;
        }
        offset++; // next sample
    }

    return buffer;

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
}

function getScale(key, scaleType = 'major') {
    // Define major and minor scales
    const scales = {
        'C': {
            'major': ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
            'minor': ['C', 'D', 'D#', 'F', 'G', 'G#', 'A#']
        },
        'C#': {
            'major': ['C#', 'D#', 'F', 'F#', 'G#', 'A#', 'C'],
            'minor': ['C#', 'D#', 'E', 'F#', 'G#', 'A', 'B']
        },
        'D': {
            'major': ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
            'minor': ['D', 'E', 'F', 'G', 'A', 'A#', 'C']
        },
        'D#': {
            'major': ['D#', 'F', 'G', 'G#', 'A#', 'C', 'D'],
            'minor': ['D#', 'F', 'F#', 'G#', 'A#', 'B', 'C#']
        },
        'E': {
            'major': ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
            'minor': ['E', 'F#', 'G', 'A', 'B', 'C', 'D']
        },
        'F': {
            'major': ['F', 'G', 'A', 'A#', 'C', 'D', 'E'],
            'minor': ['F', 'G', 'G#', 'A#', 'C', 'C#', 'D#']
        },
        'F#': {
            'major': ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'F'],
            'minor': ['F#', 'G#', 'A', 'B', 'C#', 'D', 'E']
        },
        'G': {
            'major': ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
            'minor': ['G', 'A', 'A#', 'C', 'D', 'D#', 'F']
        },
        'G#': {
            'major': ['G#', 'A#', 'C', 'C#', 'D#', 'F', 'G'],
            'minor': ['G#', 'A#', 'B', 'C#', 'D#', 'E', 'F#']
        },
        'A': {
            'major': ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
            'minor': ['A', 'B', 'C', 'D', 'E', 'F', 'G']
        },
        'A#': {
            'major': ['A#', 'C', 'D', 'D#', 'F', 'G', 'A'],
            'minor': ['A#', 'C', 'C#', 'D#', 'F', 'F#', 'G#']
        },
        'B': {
            'major': ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'],
            'minor': ['B', 'C#', 'D', 'E', 'F#', 'G', 'A']
        }
    };
    return scales[key] && scales[key][scaleType] ? scales[key][scaleType] : scales['C']['major'];
}

function getRandomKey() {
    const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return keys[Math.floor(Math.random() * keys.length)];
}

function generateQuantumElements(previousNotes) {
    // Quantum Harmonic Oscillator Parameters
    const mass = 1; // arbitrary units
    const omega = 1; // angular frequency
    const hbar = 1; // reduced Planck's constant

    // Time step based on BPM
    const bpm = parseInt(document.getElementById('bpm').value);
    const deltaT = 60 / bpm; // seconds per beat

    // Calculate position based on time evolution
    const t = previousNotes.length * deltaT;

    // Calculate x in range [-5, 5] with added noise
    const noise = (Math.random() - 0.5) * 0.2; // Small noise
    const x = Math.sin(omega * t) * 5 + noise; // oscillates between ~-5 to 5 with noise

    // Calculate the wavefunction probability density
    const psi = Math.exp(- (mass * omega * x * x) / (2 * hbar));
    const probability = psi * psi; // Probability density

    // Normalize probability (approximate for demonstration)
    const normalizedProbability = (probability / (Math.sqrt(Math.PI * hbar / (mass * omega)))) * 1.5; // Amplify

    // Determine momentum based on derivative of wavefunction
    const momentum = -mass * omega * x * Math.exp(- (mass * omega * x * x) / (2 * hbar));
    const normalizedMomentum = (momentum + mass * omega * 5) / 10; // Normalize to [0,1]

    // Spin remains random for simplicity
    const spin = Math.random() < 0.5 ? 'up' : 'down';

    return { position: normalizedProbability, momentum: normalizedMomentum, spin };
}

function mapQuantumToNote(quantum, scale, previousNotes) {
    // Map position to pitch
    let pitchIndex = Math.floor(quantum.position * scale.length);
    // Avoid repeating the same note
    if (previousNotes.length > 0) {
        const lastNote = previousNotes[previousNotes.length - 1].pitch;
        let lastIndex = scale.indexOf(lastNote);
        if (pitchIndex % scale.length === lastIndex) {
            pitchIndex = (pitchIndex + 1) % scale.length;
        }
    }

    const pitch = scale[pitchIndex % scale.length];

    // Map momentum to velocity (volume)
    const velocity = Math.max(0.1, quantum.momentum); // Ensure a minimum volume

    // Map spin to timbre (simple example: different oscillator types)
    const timbre = quantum.spin === 'up' ? 'sine' : 'square';

    return { pitch, velocity, timbre };
}

function playNote(audioCtx, note, startTime, duration) {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    // Set oscillator type based on timbre
    oscillator.type = note.timbre;

    // Set frequency based on pitch
    oscillator.frequency.value = noteToFrequency(note.pitch);

    // Set volume based on velocity
    gainNode.gain.value = note.velocity;

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
}

function noteToFrequency(note) {
    // Basic mapping from note to frequency in the 4th octave
    const a4 = 440;
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = 4;
    const semitone = notes.indexOf(note);
    if (semitone === -1) return a4; // default to A4

    // Calculate frequency
    // A4 is the 9th semitone (0-based index 9)
    const n = semitone - 9 + (octave - 4) * 12;
    const frequency = a4 * Math.pow(2, n / 12);
    return frequency;
}

// Updated visualizeWaveFunction function as shown above
function visualizeWaveFunction(scheduledNotes) {
    const canvas = document.getElementById('waveform');
    if (!canvas.getContext) {
        console.error('Canvas not supported');
        return;
    }
    const ctx = canvas.getContext('2d');

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Define margins
    const margin = 50;
    const width = canvas.width - 2 * margin;
    const height = canvas.height - 2 * margin;

    // Draw axes
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height + margin);
    ctx.lineTo(width + margin, height + margin);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Labels
    ctx.font = '14px Arial';
    ctx.fillText('Probability Density', 10, margin);
    ctx.fillText('Time', width + margin - 40, height + margin + 30);
    ctx.fillText('Momentum', width + margin + 10, margin + 10);

    // Prepare data
    const probabilityData = scheduledNotes.map(note => note.position);
    const momentumData = scheduledNotes.map(note => note.momentum);

    // Find max and min for scaling
    const maxProb = Math.max(...probabilityData);
    const minProb = Math.min(...probabilityData);
    const maxMom = Math.max(...momentumData);
    const minMom = Math.min(...momentumData);

    // Handle case where all data points are the same
    let scaledProbData, scaledMomData;
    if (maxProb === minProb) {
        console.warn('All probability data points have the same value. Adjusting for visualization.');
        scaledProbData = probabilityData.map(() => height + margin - height / 2);
    } else {
        scaledProbData = probabilityData.map(val => height + margin - ((val - minProb) / (maxProb - minProb)) * height);
    }

    if (maxMom === minMom) {
        console.warn('All momentum data points have the same value. Adjusting for visualization.');
        scaledMomData = momentumData.map(() => height + margin - height / 2);
    } else {
        scaledMomData = momentumData.map(val => height + margin - ((val - minMom) / (maxMom - minMom)) * height);
    }

    const numPoints = scheduledNotes.length;
    const xStep = width / (numPoints - 1);

    // Draw Probability Density
    ctx.beginPath();
    ctx.moveTo(margin, scaledProbData[0]);
    for (let i = 1; i < numPoints; i++) {
        ctx.lineTo(margin + i * xStep, scaledProbData[i]);
    }
    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw Momentum
    ctx.beginPath();
    ctx.moveTo(margin, scaledMomData[0]);
    for (let i = 1; i < numPoints; i++) {
        ctx.lineTo(margin + i * xStep, scaledMomData[i]);
    }
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Add Legends
    ctx.fillStyle = 'blue';
    ctx.fillRect(margin + 10, margin + 10, 10, 10);
    ctx.fillStyle = 'black';
    ctx.fillText('Probability Density', margin + 25, margin + 20);

    ctx.fillStyle = 'red';
    ctx.fillRect(margin + 10, margin + 30, 10, 10);
    ctx.fillStyle = 'black';
    ctx.fillText('Momentum', margin + 25, margin + 40);

    // Plot Spin as Circles
    for (let i = 0; i < numPoints; i++) {
        const note = scheduledNotes[i];
        const x = margin + i * xStep;
        const y = scaledProbData[i];
        const radius = 5;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = note.spin === 'up' ? 'green' : 'orange';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();

        // Optionally, add a small label for spin
        /*
        ctx.font = '10px Arial';
        ctx.fillStyle = '#000';
        ctx.fillText(note.spin === 'up' ? '↑' : '↓', x - 3, y - radius - 2);
        */
    }

    // Optional: Add a legend for Spin
    ctx.beginPath();
    ctx.arc(margin + 10, margin + 50, 5, 0, 2 * Math.PI);
    ctx.fillStyle = 'green';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.stroke();
    ctx.fillStyle = 'black';
    ctx.fillText('Spin Up', margin + 20, margin + 55);

    ctx.beginPath();
    ctx.arc(margin + 10, margin + 70, 5, 0, 2 * Math.PI);
    ctx.fillStyle = 'orange';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.stroke();
    ctx.fillStyle = 'black';
    ctx.fillText('Spin Down', margin + 20, margin + 75);
}