import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, Lock, Eye, Users, User, MapPin, GraduationCap, Briefcase, Phone, AlertCircle } from 'lucide-react';
import { User as UserType, PhonePrivacy, ProfilePrivacy, ListPrivacy } from '../types';
import { uploadMediaFile, updateUserProfile, updateUsername } from '../services/api';
import { compressImageFile } from '../utils/imageCompressor';
import { UserAvatar } from './UserAvatar';
import { shouldHideHandle } from './VerifiedBadge';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserType;
  onProfileUpdated: (updatedUser: UserType) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onProfileUpdated
}) => {
  const [newUsername, setNewUsername] = useState(currentUser.username || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [coverUrl, setCoverUrl] = useState(currentUser.coverUrl || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [gender, setGender] = useState<'male' | 'female' | ''>(currentUser.gender || 'male');
  const [birthday, setBirthday] = useState(currentUser.birthday || '');
  const [age, setAge] = useState(currentUser.age || '');
  const [hometown, setHometown] = useState(currentUser.hometown || '');
  const [school, setSchool] = useState(currentUser.school || '');
  const [work, setWork] = useState(currentUser.work || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [phonePrivacy, setPhonePrivacy] = useState<PhonePrivacy>(currentUser.phonePrivacy || 'only_me');
  const [profilePrivacy, setProfilePrivacy] = useState<ProfilePrivacy>(currentUser.profilePrivacy || 'public');
  const [followersPrivacy, setFollowersPrivacy] = useState<ListPrivacy>(currentUser.followersPrivacy || 'public');
  const [followingPrivacy, setFollowingPrivacy] = useState<ListPrivacy>(currentUser.followingPrivacy || 'public');

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNewUsername(currentUser.username || '');
      setAvatarUrl(currentUser.avatarUrl || '');
      setCoverUrl(currentUser.coverUrl || '');
      setBio(currentUser.bio || '');
      setGender(currentUser.gender || 'male');
      setBirthday(currentUser.birthday || '');
      setAge(currentUser.age || '');
      setHometown(currentUser.hometown || '');
      setSchool(currentUser.school || '');
      setWork(currentUser.work || '');
      setPhone(currentUser.phone || '');
      setPhonePrivacy(currentUser.phonePrivacy || 'only_me');
      setProfilePrivacy(currentUser.profilePrivacy || 'public');
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingAvatar(true);
      setError(null);
      const base64 = await compressImageFile(file, 800, 800, 0.85);
      const res = await uploadMediaFile(base64, file.name);
      setAvatarUrl(res.url);
    } catch (err: any) {
      setError(err.message || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingCover(true);
      setError(null);
      const base64 = await compressImageFile(file, 1600, 1000, 0.85);
      const res = await uploadMediaFile(base64, file.name);
      setCoverUrl(res.url);
    } catch (err: any) {
      setError(err.message || 'Failed to upload cover photo');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);

      // Handle 1-time username change if provided and different
      if (!currentUser.usernameChanged && newUsername && newUsername.trim() !== currentUser.username) {
        await updateUsername(newUsername.trim());
      }

      const updated = await updateUserProfile({
        avatarUrl,
        coverUrl,
        bio,
        gender,
        birthday,
        age,
        hometown,
        school,
        work,
        phone,
        phonePrivacy,
        profilePrivacy,
        followersPrivacy,
        followingPrivacy
      });

      onProfileUpdated(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-xl bg-[#242526] border border-[#3A3B3C] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-white"
        >
          {/* Header */}
          <div className="p-5 border-b border-[#3A3B3C] flex items-center justify-between bg-[#242526]">
            <div className="flex items-center space-x-2.5">
              <User className="w-5 h-5 text-white" />
              <h3 className="font-bold text-base text-white">Edit Profile</h3>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-[#B0B3B8] hover:text-white rounded-full hover:bg-[#3A3B3C] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-6 text-xs text-[#E4E6EB]">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Cover Photo Upload */}
            <div>
              <label className="block text-[#B0B3B8] font-bold mb-2">Cover Photo</label>
              <div className="relative h-32 rounded-2xl overflow-hidden bg-[#18191a] border border-[#3A3B3C] group">
                {(!coverUrl || coverUrl.endsWith('.mp4') || coverUrl.endsWith('.webm') || coverUrl.includes('data:video') || coverUrl.includes('i.imgur.com/bxsYBqJ')) ? (
                  <video
                    src={(coverUrl && (coverUrl.endsWith('.mp4') || coverUrl.endsWith('.webm') || coverUrl.includes('data:video'))) ? coverUrl : 'https://i.imgur.com/bxsYBqJ.mp4'}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={coverUrl}
                    alt="Cover"
                    className="w-full h-full object-cover"
                  />
                )}
                <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition text-white font-bold space-x-2">
                  <Camera className="w-5 h-5" />
                  <span>{uploadingCover ? 'Uploading Cover...' : 'Change Cover Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverFile}
                    disabled={uploadingCover}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Avatar Photo Upload */}
            <div>
              <label className="block text-[#B0B3B8] font-bold mb-2">Profile Picture</label>
              <div className="flex items-center space-x-4">
                <UserAvatar
                  userId={currentUser.id}
                  borderId={currentUser.borderId}
                  src={avatarUrl}
                  username={currentUser.username}
                  nickname={currentUser.nickname}
                  size="xl"
                />

                <label className="px-4 py-2.5 bg-[#18191a] hover:bg-[#3A3B3C] text-white border border-[#3A3B3C] rounded-xl font-bold cursor-pointer transition flex items-center space-x-2">
                  <Camera className="w-4 h-4 text-white" />
                  <span>{uploadingAvatar ? 'Uploading...' : 'Upload New Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFile}
                    disabled={uploadingAvatar}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* 1-Time Username Change Section */}
            <div className="p-4 rounded-2xl bg-[#18191a] border border-[#3A3B3C] space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-white font-bold">Username</label>
                {currentUser.usernameChanged ? (
                  <span className="text-[10px] text-[#B0B3B8] font-medium">1-Time Limit Used</span>
                ) : (
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">1 Change Allowed</span>
                )}
              </div>

              {currentUser.usernameChanged || shouldHideHandle(currentUser) ? (
                <div className="flex items-center space-x-2">
                  {!shouldHideHandle(currentUser) && (
                    <span className="text-sm font-mono font-bold text-white">@{currentUser.username}</span>
                  )}
                  <span className="text-[11px] text-[#B0B3B8] font-normal">
                    {shouldHideHandle(currentUser) ? '(Protected Official Account)' : '(Cannot be changed again)'}
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#B0B3B8] font-mono">@</span>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder={currentUser.username}
                      className="w-full bg-[#242526] border border-[#3A3B3C] rounded-xl py-2 pl-8 pr-3 text-sm font-mono text-white placeholder-[#8A8D91] focus:outline-none focus:border-[#4E4F50] transition"
                    />
                  </div>
                  <p className="text-[11px] text-[#B0B3B8]">
                    You can change your username 1 time.
                  </p>
                </div>
              )}
            </div>

            {/* Bio */}
            <div>
              <label className="block text-[#B0B3B8] font-bold mb-1.5">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Describe yourself..."
                rows={2}
                className="w-full bg-[#18191a] border border-[#3A3B3C] rounded-xl p-3 text-white placeholder-[#8A8D91] focus:outline-none focus:border-[#4E4F50] transition resize-none"
              />
            </div>

            {/* Profile Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[#B0B3B8] font-bold mb-1 flex items-center space-x-1.5">
                  <User className="w-3.5 h-3.5 text-white" />
                  <span>Gender</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGender('male')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1 cursor-pointer ${
                      gender === 'male'
                        ? 'bg-[#3A3B3C] border-[#4E4F50] text-white'
                        : 'bg-[#18191a] border-[#3A3B3C] text-[#B0B3B8]'
                    }`}
                  >
                    <span>Male</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('female')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1 cursor-pointer ${
                      gender === 'female'
                        ? 'bg-[#3A3B3C] border-[#4E4F50] text-white'
                        : 'bg-[#18191a] border-[#3A3B3C] text-[#B0B3B8]'
                    }`}
                  >
                    <span>Female</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[#B0B3B8] font-bold mb-1 flex items-center space-x-1.5">
                  <User className="w-3.5 h-3.5 text-white" />
                  <span>Birth Date</span>
                </label>
                <input
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="w-full bg-[#18191a] border border-[#3A3B3C] rounded-xl p-2.5 text-white focus:outline-none focus:border-[#4E4F50] transition cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[#B0B3B8] font-bold mb-1 flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-white" />
                  <span>Hometown</span>
                </label>
                <input
                  type="text"
                  value={hometown}
                  onChange={(e) => setHometown(e.target.value)}
                  placeholder="e.g. Manila, Philippines"
                  className="w-full bg-[#18191a] border border-[#3A3B3C] rounded-xl p-2.5 text-white placeholder-[#8A8D91] focus:outline-none focus:border-[#4E4F50] transition"
                />
              </div>

              <div>
                <label className="block text-[#B0B3B8] font-bold mb-1 flex items-center space-x-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-white" />
                  <span>School / University</span>
                </label>
                <input
                  type="text"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder="e.g. UST"
                  className="w-full bg-[#18191a] border border-[#3A3B3C] rounded-xl p-2.5 text-white placeholder-[#8A8D91] focus:outline-none focus:border-[#4E4F50] transition"
                />
              </div>

              <div>
                <label className="block text-[#B0B3B8] font-bold mb-1 flex items-center space-x-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-white" />
                  <span>Work / Job</span>
                </label>
                <input
                  type="text"
                  value={work}
                  onChange={(e) => setWork(e.target.value)}
                  placeholder="e.g. Software Developer"
                  className="w-full bg-[#18191a] border border-[#3A3B3C] rounded-xl p-2.5 text-white placeholder-[#8A8D91] focus:outline-none focus:border-[#4E4F50] transition"
                />
              </div>
            </div>

            {/* Phone & Privacy */}
            <div className="p-4 rounded-2xl bg-[#18191a] border border-[#3A3B3C] space-y-3">
              <label className="block text-white font-bold flex items-center space-x-1.5">
                <Lock className="w-4 h-4 text-white" />
                <span>Profile & Contact Privacy</span>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#B0B3B8] font-medium mb-1">Profile Visibility</label>
                  <select
                    value={profilePrivacy}
                    onChange={(e) => setProfilePrivacy(e.target.value as ProfilePrivacy)}
                    className="w-full bg-[#242526] border border-[#3A3B3C] rounded-xl p-2.5 text-white focus:outline-none focus:border-[#4E4F50] transition"
                  >
                    <option value="public">Public (Everyone can view profile & posts)</option>
                    <option value="only_me">Only Me (Private - Hidden from other users)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#B0B3B8] font-medium mb-1">Phone Privacy</label>
                  <select
                    value={phonePrivacy}
                    onChange={(e) => setPhonePrivacy(e.target.value as PhonePrivacy)}
                    className="w-full bg-[#242526] border border-[#3A3B3C] rounded-xl p-2.5 text-white focus:outline-none focus:border-[#4E4F50] transition"
                  >
                    <option value="only_me">Only Me (Hidden)</option>
                    <option value="friends">Friends Only</option>
                    <option value="public">Public</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#B0B3B8] font-medium mb-1">Followers List Privacy</label>
                  <select
                    value={followersPrivacy}
                    onChange={(e) => setFollowersPrivacy(e.target.value as ListPrivacy)}
                    className="w-full bg-[#242526] border border-[#3A3B3C] rounded-xl p-2.5 text-white focus:outline-none focus:border-[#4E4F50] transition"
                  >
                    <option value="public">Public (Everyone)</option>
                    <option value="friends">Friends Only</option>
                    <option value="only_me">Only Me</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#B0B3B8] font-medium mb-1">Following List Privacy</label>
                  <select
                    value={followingPrivacy}
                    onChange={(e) => setFollowingPrivacy(e.target.value as ListPrivacy)}
                    className="w-full bg-[#242526] border border-[#3A3B3C] rounded-xl p-2.5 text-white focus:outline-none focus:border-[#4E4F50] transition"
                  >
                    <option value="public">Public (Everyone)</option>
                    <option value="friends">Friends Only</option>
                    <option value="only_me">Only Me</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#B0B3B8] font-medium mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+63 912 345 6789"
                  className="w-full bg-[#242526] border border-[#3A3B3C] rounded-xl p-2.5 text-white placeholder-[#8A8D91] focus:outline-none focus:border-[#4E4F50] transition"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-2 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[#3A3B3C] text-[#B0B3B8] hover:text-white font-bold transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-[#3A3B3C] hover:bg-[#4E4F50] text-white font-bold rounded-xl transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
