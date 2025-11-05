import express from 'express';
import cors from 'cors';
import fs from 'fs-extra';
import path from 'path';
import { MusicRNN, sequences } from '@magenta/music';
import MidiWriter from 'midi-writer-js';

const app = express();
app.use(cors());
app.use(express.json());

const GENERATED_DIR = path.join(process.cwd(), 'generated');
fs.ensureDirSync(GENERATED_DIR);

// Endpoint to generate music
app.post('/generate', async (req, res) => {
  const { genre = 'simple', mood = 'happy' } = req.body;

  try {
    // Initialize MusicRNN pre-trained model
    const rnn = new MusicRNN('https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn');
    await rnn.initialize();

    // Seed melody
    const seed = {
      notes: [
        { pitch: 60, startTime: 0, endTime: 0.5 },
        { pitch: 62, startTime: 0.5, endTime: 1 },
      ],
      totalTime: 1
    };

    const quantizedSeed = sequences.quantizeNoteSequence(seed, 4);

    // Generate 32 steps (notes)
    const generatedSeq = await rnn.continueSequence(quantizedSeed, 32, 1.0);

    // Convert to MIDI
    const track = new MidiWriter.Track();
    generatedSeq.notes.forEach(note => {
      track.addEvent(new MidiWriter.NoteEvent({
        pitch: [note.pitch],
        duration: '8'
      }));
    });

    const write = new MidiWriter.Writer(track);
    const fileName = `music_${Date.now()}.mid`;
    const filePath = path.join(GENERATED_DIR, fileName);

    fs.writeFileSync(filePath, write.buildFile());

    res.json({ url: `http://localhost:3000/music/${fileName}` });
    await rnn.dispose();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Serve generated files
app.use('/music', express.static(GENERATED_DIR));

app.listen(3000, () => console.log('Backend running on http://localhost:3000'));
