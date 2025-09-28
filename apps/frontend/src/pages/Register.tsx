import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { userAtom } from '../atoms/userAtom';
import { useNavigate, useParams } from 'react-router-dom';
import { socketAtom } from '../atoms/socketAtom';
import { IP_ADDRESS } from '../Globle'; // Assuming this file exists and exports the IP

// --- Helper Components & Icons ---

const Spinner = () => (
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
);

const FeatureIcon = ({ children }: { children: React.ReactNode }) => (
    <div className="bg-gray-700/50 p-2 rounded-full mr-4 shrink-0">
        {children}
    </div>
);

const Register = () => {
    const [name, setName] = useState<string>("");
    const [roomId, setRoomId] = useState<string>("");
    const [error, setError] = useState<string>("");
    
    const params = useParams();
    const [user, setUser] = useRecoilState(userAtom);
    const [socket, setSocket] = useRecoilState<WebSocket | null>(socketAtom);
    const [loading, setLoading] = useState<boolean>(false);
    const navigate = useNavigate();

    useEffect(() => {
        document.title = "CoLearn - Collaborative Coding";
        // Pre-fill room ID from the URL parameter
        setRoomId(params.roomId || "");
    }, [params.roomId]);

    const generateId = () => {
        return Math.floor(Math.random() * 100000).toString();
    }

    // This is your original, working socket logic
    const initializeSocket = (isJoining = false) => {
        setError(""); // Clear previous errors
        if (name.trim() === "") {
            setError("Please enter a name to continue.");
            return;
        }
        if (isJoining && (roomId.trim() === "" || roomId.length !== 6)) {
            setError("Please enter a valid 6-digit Room ID to join.");
            return;
        }

        setLoading(true);
        let generatedId = "";
        if (user.id === "") {
            generatedId = generateId();
        }

        if (!socket || socket.readyState === WebSocket.CLOSED) {
            const u = {
                id: user.id === "" ? generatedId : user.id,
                name: name
            };
            
            const ws = new WebSocket(`ws://${IP_ADDRESS}:5000?roomId=${roomId}&id=${u.id}&name=${u.name}`);
            setSocket(ws);

            ws.onopen = () => {
                console.log("Connected to WebSocket");
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === "roomId") {
                    setUser({
                        id: user.id === "" ? generatedId : user.id,
                        name: name,
                        roomId: data.roomId
                    });
                    setLoading(false);
                    console.log("Server Message: ", data.message); // Log instead of alert
                    navigate("/code/" + data.roomId);
                } else if (data.type === 'error') {
                    setError(data.message);
                    setLoading(false);
                    ws.close();
                }
            };

            ws.onclose = () => {
                console.log("WebSocket connection closed.");
                setLoading(false);
            };

            ws.onerror = (err) => {
                console.error("WebSocket error:", err);
                setError("Failed to connect to the server. Please try again.");
                setLoading(false);
            };
        } else {
            console.log("Socket connection already exists.");
            setLoading(false);
        }
    }

    const handleCreateRoom = () => {
        if (!loading) initializeSocket(false);
    }

    const handleJoinRoom = () => {
        if (!loading) initializeSocket(true);
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center font-sans p-6 overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/30 rounded-full blur-3xl animate-pulse"></div>
            <main className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center z-10">
                
                {/* Left Side: Information about CoLearn */}
                <div className="space-y-6">
                    <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight">CoLearn</h1>
                    <p className="text-gray-300 text-lg md:text-xl leading-relaxed">
                        The ultimate platform for collaborative learning. Code in real-time, get instant feedback from our AI assistant, and master everything from basic algorithms to complex software architecture together.
                    </p>
                    <ul className="space-y-4 pt-4">
                        <li className="flex items-center"><FeatureIcon><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg></FeatureIcon><span className="text-gray-200"><strong>Real-time Collaborative Editor:</strong> Code together with zero latency.</span></li>
                        <li className="flex items-center"><FeatureIcon><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect x="4" y="12" width="8" height="8" rx="2"/><path d="M20 12h-4"/><path d="m16 12-4 4-4-4"/></svg></FeatureIcon><span className="text-gray-200"><strong>AI-Powered Assistant:</strong> Get hints, debug code, and learn best practices.</span></li>
                        <li className="flex items-center"><FeatureIcon><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" x2="12" y1="9" y2="13"></line><line x1="12" x2="12.01" y1="17" y2="17"></line></svg></FeatureIcon><span className="text-gray-200"><strong>Architecture Nudges:</strong> Our AI guides you towards scalable and efficient code design.</span></li>
                    </ul>
                </div>
                
                {/* Right Side: Join/Create Room Form */}
                <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 p-8 rounded-2xl shadow-2xl">
                    <h2 className="text-2xl font-bold mb-6 text-center">Join or Create a Room</h2>
                    <div className="space-y-6">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-400 mb-2">Name</label>
                            <input type="text" id="name" placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-3 bg-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200" />
                        </div>
                        <div>
                            <label htmlFor="roomId" className="block text-sm font-medium text-gray-400 mb-2">Room ID (for joining)</label>
                            <input type="text" id="roomId" placeholder="Enter 6-digit Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} className="w-full p-3 bg-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200" />
                        </div>
                        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                        <div className="flex flex-col space-y-4 pt-2">
                            <button disabled={loading} onClick={handleJoinRoom} className="w-full h-12 flex items-center justify-center py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-transform duration-300 transform hover:scale-105">{loading ? <Spinner /> : 'Join Room'}</button>
                            <button disabled={loading} onClick={handleCreateRoom} className="w-full h-12 flex items-center justify-center py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-transform duration-300 transform hover:scale-105">{loading ? <Spinner /> : 'Create New Room'}</button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Register;
