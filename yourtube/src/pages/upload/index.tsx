import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import VideoUploader from "@/components/VideoUploader";
import Channeldialogue from "@/components/channeldialogue";
import { useUser } from "@/lib/AuthContext";

export default function UploadPage() {
    const { user } = useUser();
    const [isdialogeopen, setisdialogeopen] = useState(false);

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="text-sm text-gray-600">
                    Please sign in to upload videos.
                </div>
            </div>
        );
    }

    // If user hasn't created a channel yet, force-create it first
    if (!user?.channelname) {
        return (
            <div className="min-h-screen bg-white p-4">
                <div className="max-w-2xl mx-auto space-y-4">
                    <div className="text-lg font-semibold">Create your channel first</div>
                    <div className="text-sm text-gray-600">
                        Channel name is required before you can upload.
                    </div>

                    <Button onClick={() => setisdialogeopen(true)}>Create Channel</Button>

                    <Channeldialogue
                        isopen={isdialogeopen}
                        onclose={() => setisdialogeopen(false)}
                        mode="create"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white p-4">
            <div className="max-w-3xl mx-auto">
                <VideoUploader channelId={user._id} channelName={user.channelname} />
            </div>
        </div>
    );
}