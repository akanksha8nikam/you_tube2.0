import React, { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { formatDistanceToNow } from "date-fns";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { toast } from "sonner";

interface Comment {
  _id: string;
  videoid: string;
  userid: string;
  commentbody: string;
  usercommented: string;
  city?: string;
  likes?: string[];
  dislikes?: string[];
  likesCount?: number;
  dislikesCount?: number;
  commentedon: string;
}

const languageOptions = [
  { label: "English", value: "en" },
  { label: "Hindi", value: "hi" },
  { label: "Spanish", value: "es" },
  { label: "French", value: "fr" },
  { label: "German", value: "de" },
  { label: "Japanese", value: "ja" },
];

const Comments = ({ videoId }: any) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [city, setCity] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [translated, setTranslated] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editCity, setEditCity] = useState("");
  const { user } = useUser();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadComments();
  }, [videoId]);

  const loadComments = async () => {
    try {
      const res = await axiosInstance.get(`/comment/${videoId}`);
      setComments(res.data);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };
  if (loading) {
    return <div>Loading history...</div>;
  }
  const handleSubmitComment = async () => {
    if (!user || !newComment.trim()) return;

    setIsSubmitting(true);
    
    // Only fetch if city is not already set by detectCity
    if (!city) {
      try {
        const geoRes = await fetch("https://ipapi.co/json/");
        if (geoRes.ok) {
          const geo = await geoRes.json();
          if (geo?.city) setCity(geo.city);
        }
      } catch (error) {
        // Fallback silently
      }
    }

    try {
      const res = await axiosInstance.post("/comment/postcomment", {
        videoid: videoId,
        userid: user._id,
        commentbody: newComment,
        usercommented: user.name,
        city: city || "Unknown",
      });
      if (res.data.comment) {
        const newCommentObj: Comment = res.data.data;
        setComments([newCommentObj, ...comments]);
      }
      setNewComment("");
      setCity("");
    } catch (error) {
      const message =
        (error as any)?.response?.data?.message || "Failed to add comment.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (comment: Comment) => {
    setEditingCommentId(comment._id);
    setEditText(comment.commentbody);
    setEditCity(comment.city || "");
  };

  const handleUpdateComment = async () => {
    if (!editText.trim()) return;
    try {
      const res = await axiosInstance.post(
        `/comment/editcomment/${editingCommentId}`,
        { commentbody: editText, userid: user?._id, city: editCity }
      );
      if (res.data) {
        setComments((prev) =>
          prev.map((c) =>
            c._id === editingCommentId ? { ...c, ...res.data } : c
          )
        );
        setEditingCommentId(null);
        setEditText("");
        setEditCity("");
      }
    } catch (error) {
      const message =
        (error as any)?.response?.data?.message || "Failed to update comment.";
      toast.error(message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await axiosInstance.delete(`/comment/deletecomment/${id}`, {
        data: { userid: user?._id },
      });
      if (res.data.comment) {
        setComments((prev) => prev.filter((c) => c._id !== id));
      }
    } catch (error) {
      const message =
        (error as any)?.response?.data?.message || "Failed to delete comment.";
      toast.error(message);
    }
  };

  const handleReaction = async (id: string, reaction: "like" | "dislike") => {
    if (!user?._id) return;
    try {
      const res = await axiosInstance.post(`/comment/react/${id}`, {
        userId: user._id,
        reaction,
      });
      if (res.data.deleted) {
        setComments((prev) => prev.filter((c) => c._id !== id));
        return;
      }
      setComments((prev) =>
        prev.map((c) =>
          c._id === id
            ? {
                ...c,
                likesCount: res.data.likesCount,
                dislikesCount: res.data.dislikesCount,
                likes: res.data.likes,
                dislikes: res.data.dislikes,
              }
            : c
        )
      );
    } catch (error) {
      const message =
        (error as any)?.response?.data?.message ||
        "Failed to update reaction. Use another account to react to your own comment.";
      toast.error(message);
    }
  };

  const handleTranslate = async (id: string) => {
    try {
      const res = await axiosInstance.post(`/comment/translate/${id}`, {
        targetLanguage: selectedLanguage,
      });
      const translatedText = res?.data?.translatedText;
      if (!translatedText) {
        toast.error("Translation currently unavailable.");
        return;
      }
      setTranslated((prev) => ({ ...prev, [id]: translatedText }));
      if (res?.data?.message) {
        toast.message(res.data.message);
      }
    } catch (error) {
      const message =
        (error as any)?.response?.data?.message || "Failed to translate comment.";
      toast.error(message);
    }
  };

  const detectCity = async () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}`
          );
          if (!geoRes.ok) {
            toast.error("Could not detect city right now.");
            return;
          }
          const geo = await geoRes.json();
          const detectedCity =
            geo?.address?.city ||
            geo?.address?.town ||
            geo?.address?.village ||
            geo?.address?.state ||
            "";
          if (detectedCity) setCity(detectedCity);
          else toast.error("City not found for your current location.");
        } catch (error) {
          toast.error("Could not detect city.");
        }
      },
      () => {
        toast.error("Location permission denied.");
      }
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{comments.length} Comments</h2>

      {user && (
        <div className="flex gap-4">
          <Avatar className="w-10 h-10">
            <AvatarImage src={user.image || ""} />
            <AvatarFallback>{user.name?.[0] || "U"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e: any) => setNewComment(e.target.value)}
              onFocus={() => { if(!city) detectCity(); }}
              className="min-h-[80px] resize-none border-0 border-b-2 bg-transparent text-foreground rounded-none focus-visible:ring-0 mb-3"
            />
            {city && (
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <span>📍 Posting from:</span>
                <span className="font-semibold text-foreground">{city}</span>
                <button onClick={() => setCity("")} className="ml-1 hover:text-red-500">✕</button>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={() => setNewComment("")}
                disabled={!newComment.trim()}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || isSubmitting}
                className="bg-blue-400 hover:bg-blue-500 text-white transition-colors"
              >
                Comment
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No comments yet. Be the first to comment!
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment._id} className="flex gap-4">
              <Avatar className="w-10 h-10">
                <AvatarImage src="/placeholder.svg?height=40&width=40" />
                <AvatarFallback>{comment.usercommented[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm text-foreground">
                    {comment.usercommented} • {comment.city || "Unknown"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.commentedon))} ago
                  </span>
                </div>

                {editingCommentId === comment._id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                    />
                    <input
                      className="border rounded px-3 py-2 text-sm w-full"
                      placeholder="City"
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        onClick={handleUpdateComment}
                        disabled={!editText.trim()}
                      >
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditingCommentId(null);
                          setEditText("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm">{translated[comment._id] || comment.commentbody}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!user?._id}
                        onClick={() => handleReaction(comment._id, "like")}
                        className="bg-muted hover:bg-muted/80 text-foreground border-none transition-colors shadow-sm"
                      >
                        👍 {comment.likesCount || comment.likes?.length || 0}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!user?._id}
                        onClick={() => handleReaction(comment._id, "dislike")}
                        className="bg-muted hover:bg-muted/80 text-foreground border-none transition-colors shadow-sm"
                      >
                        👎 {comment.dislikesCount || comment.dislikes?.length || 0}
                      </Button>
                      <select
                        className="bg-muted border border-border rounded-lg px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all cursor-pointer hover:bg-muted/80 shadow-sm"
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                      >
                        {languageOptions.map((l) => (
                          <option key={l.value} value={l.value} className="bg-background text-foreground">
                            {l.label}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleTranslate(comment._id)}
                        className="bg-blue-800 hover:bg-blue-900 text-white transition-colors shadow-sm"
                      >
                        Translate
                      </Button>
                    </div>
                    {comment.userid === user?._id && (
                      <div className="flex gap-2 mt-2 text-sm text-muted-foreground">
                        <button onClick={() => handleEdit(comment)} className="hover:text-foreground">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(comment._id)} className="hover:text-foreground">
                          Delete
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Comments;
