// import { AudioPrompt } from '@/core/types/audio-prompt.type';
// import { constructBlobURL } from '@/core/utils/blob.util';
import { Service } from '@angular/core';
// import { Functions, httpsCallable } from 'firebase/functions';
// import { StreamMessage } from '../types/stream-message.type';
// import { ConfigService } from './config.service';

@Service()
export class SpeechService {
  // private configService = inject(ConfigService);
  // private get functions(): Functions {
  //   if (!this.configService.functions) {
  //     throw new Error('Firebase Functions has not been initialized.');
  //   }
  //   return this.configService.functions;
  // }
  // async generateAudio(audioPrompt: AudioPrompt) {
  //   const readFactFunction = httpsCallable<AudioPrompt, string>(
  //     this.functions, 'textToAudio-readFact'
  //   );
  //   const { data: audioUri } = await readFactFunction(audioPrompt);
  //   return audioUri;
  // }
  // async generateAudioStream(audioPrompt: AudioPrompt) {
  //   const readFactStreamFunction = httpsCallable<AudioPrompt, number[] | undefined, StreamMessage>(
  //     this.functions, 'textToAudio-readFact'
  //   );
  //   return readFactStreamFunction.stream(audioPrompt);
  // }
  // async generateAudioBlobURL(audioPrompt: AudioPrompt) {
  //   const { stream, data } = await this.generateAudioStream(audioPrompt);
  //   const audioParts: BlobPart[] = [];
  //   for await (const audioChunk of stream) {
  //     if (audioChunk && audioChunk.type === 'data') {
  //       audioParts.push(new Uint8Array(audioChunk.payload.buffer.data));
  //     }
  //   }
  //   const wavHeader = await data;
  //   if (wavHeader && wavHeader.length) {
  //     audioParts.unshift(new Uint8Array(wavHeader));
  //   }
  //   return constructBlobURL(audioParts);
  // }
}
