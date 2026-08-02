import React, { useState, useRef } from 'react';
import {
  Send,
  Paperclip,
  Mic,
  Smile,
  Image as ImageIcon,
  Square,
  Trash2,
  FileText,
  Video as VideoIcon
} from 'lucide-react';
import { uploadMediaFile } from '../services/api';
import { compressImageFile } from '../utils/imageCompressor';
import { playRecordStartBeep } from '../utils/sound';

interface ChatInputProps {
  onSendMessage: (data: {
    content: string;
    mediaType?: 'text' | 'image' | 'video' | 'file' | 'audio';
    mediaUrl?: string;
    mediaName?: string;
    mediaSize?: number;
    audioDuration?: number;
    replyToMessageId?: string;
  }) => void;
  onTyping: (isTyping: boolean) => void;
  replyToMessage?: {
    id: string;
    senderNickname?: string;
    content: string;
  } | null;
  onCancelReply?: () => void;
}

const COMMON_EMOJIS = ['❤️', '👍', '😊', '🔥', '😂', '😍', '🎉', '✨', '🙌', '🙏', '💯', '😎', '💀', '🥺', '🚀', '💖'];
const SAMPLE_GIFS = [
  'https://media.giphy.com/media/l0HlHJGHe3yAMhdQY/giphy.gif',
  'https://media.giphy.com/media/d31w24psGYeekCXY/giphy.gif',
  'https://media.giphy.com/media/3o7TKsjRrfIPjeiVyM/giphy.gif',
  'https://media.giphy.com/media/xT0xezQGU5xCDJuCPe/giphy.gif',
  'https://media.giphy.com/media/l41YkxvU8c7J7Bba0/giphy.gif'
];

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onTyping,
  replyToMessage,
  onCancelReply
}) => {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);

  // Attachment preview state
  const [pendingFile, setPendingFile] = useState<{
    dataUrl: string;
    name: string;
    type: 'image' | 'video' | 'file';
    size: number;
  } | null>(null);
  const [uploading, setUploading] = useState(false);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimerRef = useRef<any>(null);
  const isSubmittingRef = useRef<boolean>(false);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);

    // Typing notification trigger
    onTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      onTyping(false);
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (isSubmittingRef.current || uploading || isSending) return;
    isSubmittingRef.current = true;

    if (pendingFile) {
      try {
        setIsSending(true);
        setUploading(true);
        const uploaded = await uploadMediaFile(pendingFile.dataUrl, pendingFile.name);
        await onSendMessage({
          content: text.trim(),
          mediaType: pendingFile.type,
          mediaUrl: uploaded.url,
          mediaName: pendingFile.name,
          mediaSize: pendingFile.size,
          replyToMessageId: replyToMessage?.id
        });
        setPendingFile(null);
        setText('');
        if (onCancelReply) onCancelReply();
      } catch (err) {
        console.error('File send error', err);
      } finally {
        setUploading(false);
        setIsSending(false);
        isSubmittingRef.current = false;
      }
      return;
    }

    if (!text.trim()) {
      isSubmittingRef.current = false;
      return;
    }

    const contentToSend = text.trim();
    setText('');
    onTyping(false);
    if (onCancelReply) onCancelReply();

    try {
      setIsSending(true);
      await onSendMessage({
        content: contentToSend,
        replyToMessageId: replyToMessage?.id
      });
    } catch (err) {
      console.error('Send error', err);
    } finally {
      setIsSending(false);
      isSubmittingRef.current = false;
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let fileKind: 'image' | 'video' | 'file' = 'file';
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|heic|bmp)$/i.test(file.name);
    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/i.test(file.name);

    if (isImage) fileKind = 'image';
    else if (isVideo) fileKind = 'video';

    try {
      let dataUrl: string;
      if (isImage) {
        dataUrl = await compressImageFile(file, 1200, 1200, 0.85);
      } else {
        dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      setPendingFile({
        dataUrl,
        name: file.name,
        type: fileKind,
        size: file.size
      });
    } catch (err) {
      console.error('File select processing error:', err);
    }
  };

  // Audio Recording Handlers
  const startRecording = async () => {
    try {
      playRecordStartBeep();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied or error:', err);
      alert('Microphone access is required to record voice notes.');
    }
  };

  const stopAndSendRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const duration = recordingSeconds;

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        try {
          setUploading(true);
          const uploaded = await uploadMediaFile(base64Audio, 'voicenote.webm');
          onSendMessage({
            content: 'Voice Note',
            mediaType: 'audio',
            mediaUrl: uploaded.url,
            audioDuration: duration,
            replyToMessageId: replyToMessage?.id
          });
          if (onCancelReply) onCancelReply();
        } catch (err) {
          console.error('Voice send error', err);
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(audioBlob);

      // Stop stream tracks
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    };

    mediaRecorderRef.current.stop();
    setIsRecording(false);
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    setIsRecording(false);
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setRecordingSeconds(0);
  };

  return (
    <div className="relative p-2.5 sm:p-4 bg-slate-900/95 border-t border-slate-800/80 backdrop-blur-lg shrink-0 z-10 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        type="file"
        ref={mediaInputRef}
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Reply Quote Banner */}
      {replyToMessage && (
        <div className="mb-3 p-2.5 rounded-xl bg-[#18191a] border border-[#3A3B3C] flex items-center justify-between">
          <div className="overflow-hidden pr-2">
            <span className="text-[10px] font-bold text-white uppercase tracking-wider block">
              Replying to {replyToMessage.senderNickname}
            </span>
            <p className="text-xs text-[#B0B3B8] truncate">{replyToMessage.content || 'Media message'}</p>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 text-[#B0B3B8] hover:text-white rounded-full transition cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Pending File Attachment Preview */}
      {pendingFile && (
        <div className="mb-3 p-2.5 rounded-xl bg-[#18191a] border border-[#3A3B3C] flex items-center justify-between">
          <div className="flex items-center space-x-3 overflow-hidden">
            {pendingFile.type === 'image' ? (
              <img src={pendingFile.dataUrl} alt="Preview" draggable={false} className="w-10 h-10 rounded-lg object-cover" />
            ) : pendingFile.type === 'video' ? (
              <div className="p-2 bg-[#3A3B3C] text-white rounded-lg">
                <VideoIcon className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 bg-[#3A3B3C] text-white rounded-lg">
                <FileText className="w-5 h-5" />
              </div>
            )}
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">{pendingFile.name}</p>
              <p className="text-[10px] text-[#B0B3B8]">{(pendingFile.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          <button
            onClick={() => setPendingFile(null)}
            className="p-1 text-[#B0B3B8] hover:text-rose-400 rounded-full transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Emoji & GIF Picker Modal */}
      {showEmojiPicker && (
        <div className="absolute bottom-20 left-4 z-40 p-3 bg-[#242526] border border-[#3A3B3C] rounded-2xl shadow-2xl w-64">
          <div className="flex justify-between items-center mb-2 pb-1 border-b border-[#3A3B3C]">
            <span className="text-xs font-semibold text-[#B0B3B8]">Quick Emojis</span>
            <button onClick={() => setShowEmojiPicker(false)} className="text-xs text-[#B0B3B8] hover:text-white cursor-pointer">
              Close
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2 text-xl">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  setText((prev) => prev + emoji);
                  setShowEmojiPicker(false);
                }}
                className="hover:scale-125 transition p-1 text-center cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Voice Recording Overlay Mode */}
      {isRecording ? (
        <div className="flex items-center justify-between bg-[#18191a] border border-[#3A3B3C] rounded-2xl p-3">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Recording Voice Note: {Math.floor(recordingSeconds / 60)}:
              {(recordingSeconds % 60).toString().padStart(2, '0')}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={cancelRecording}
              className="p-2 text-[#B0B3B8] hover:text-rose-400 rounded-xl transition cursor-pointer"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={stopAndSendRecording}
              className="px-4 py-2 bg-[#3A3B3C] hover:bg-[#4E4F50] text-white font-semibold text-xs rounded-xl flex items-center space-x-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Voice</span>
            </button>
          </div>
        </div>
      ) : (
        /* Normal Input Bar */
        <div className="flex items-center space-x-1 sm:space-x-2">
          {/* Photos & Videos Button */}
          <button
            onClick={() => mediaInputRef.current?.click()}
            className="p-2 sm:p-2.5 text-[#B0B3B8] hover:text-white hover:bg-[#3A3B3C] rounded-xl transition shrink-0 cursor-pointer"
            title="Attach photo or video"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          {/* Attachment File Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 sm:p-2.5 text-[#B0B3B8] hover:text-white hover:bg-[#3A3B3C] rounded-xl transition shrink-0 cursor-pointer"
            title="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Emoji Picker Button */}
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2.5 text-[#B0B3B8] hover:text-white hover:bg-[#3A3B3C] rounded-xl transition shrink-0 cursor-pointer"
            title="Add emoji"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Textarea */}
          <textarea
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Write a message..."
            rows={1}
            className="flex-1 bg-[#18191a] border border-[#3A3B3C] rounded-2xl py-2.5 px-4 text-sm text-white placeholder-[#8A8D91] focus:outline-none focus:border-[#4E4F50] resize-none max-h-24"
          />

          {/* Voice Record or Send Button */}
          {text.trim() || pendingFile ? (
            <button
              onClick={handleSend}
              disabled={uploading || isSending}
              className="p-2.5 rounded-xl bg-[#3A3B3C] hover:bg-[#4E4F50] text-white transition active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
            >
              {uploading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          ) : (
            <button
              onClick={startRecording}
              className="p-2.5 text-[#B0B3B8] hover:text-white hover:bg-[#3A3B3C] rounded-xl transition shrink-0 cursor-pointer"
              title="Record voice note"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
