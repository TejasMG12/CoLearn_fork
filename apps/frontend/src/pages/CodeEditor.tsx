import React, { useState, useEffect, useRef } from "react";
import MonacoEditor from '@monaco-editor/react';
import { userAtom } from "../atoms/userAtom";
import { useRecoilState } from "recoil";
import { AiOutlineLoading3Quarters, AiOutlineSend } from "react-icons/ai"; // Import spinner and send icon
import { socketAtom } from "../atoms/socketAtom";
import { useNavigate, useParams } from "react-router-dom";
import { connectedUsersAtom } from "../atoms/connectedUsersAtom";
import { IP_ADDRESS } from "../Globle";

// AI Message type
type AiMessage = {
  sender: 'user' | 'ai';
  text: string;
};

const CodeEditor: React.FC = () => {
  const [code, setCode] = useState<any>("// Write your code here...");
  const [language, setLanguage] = useState("javascript");
  const [output, setOutput] = useState<string[]>([]); // Output logs
  const [socket, setSocket] = useRecoilState<WebSocket | null>(socketAtom);
  const [isLoading, setIsLoading] = useState(false); // Loading state for code submission
  const [currentButtonState, setCurrentButtonState] = useState("Run Code");
  const [input, setInput] = useState<string>(""); // Input for code
  const [user, setUser] = useRecoilState(userAtom);
  const navigate = useNavigate();

  // AI Assistant State
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const aiChatEndRef = useRef<HTMLDivElement>(null);


  // multiplayer state
  const [connectedUsers, setConnectedUsers] = useRecoilState<any[]>(connectedUsersAtom);
  const params = useParams();

  // WebSocket connection logic
  useEffect(() => {

    if (!socket) {
      navigate("/" + params.roomId);
    }
    else {
      // request to get all users on start
      socket.send(
        JSON.stringify({
          type: "requestToGetUsers",
          userId: user.id
        })
      );


      // request to get all data on start
      socket.send(
        JSON.stringify({
          type: "requestForAllData",
        })
      );
      socket.onclose = () => {
        console.log("Connection closed");
        setUser({
          id: "",
          name: "",
          roomId: "",
        })
        setSocket(null);
      }
    }
    return () => {
      // Clean up the socket connection when the component unmounts
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, []);


  useEffect(() => {
    if (socket) {
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // on change of user
        if (data.type === "users") {
          setConnectedUsers(data.users);
        }
        // on change of code
        if (data.type === "code") {
          setCode(data.code);
        }

        // on change of input
        if (data.type === "input") {
          setInput(data.input);
        }

        // on change of language
        if (data.type === "language") {
          setLanguage(data.language);
        }

        // on change of Submit Button Status
        if (data.type === "submitBtnStatus") {
          setCurrentButtonState(data.value);
          setIsLoading(data.isLoading);
        }

        // on change of output
        if (data.type === "output") {
          setOutput((prevOutput) => [...prevOutput, data.message]);
          handleButtonStatus("Run Code", false);
        }

        // on receive cursor position
        if (data.type === "cursorPosition") {
          // Update cursor position for the user
          const updatedUsers = connectedUsers.map((user) => {
            if (user.id === data.userId) {
              return { ...user, cursorPosition: data.cursorPosition };
            }
            return user;
          });
          setConnectedUsers(updatedUsers);
        }

        // send all data to new user on join  
        if (data.type === "requestForAllData") {
          // Ensure socket is open before sending
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(
              JSON.stringify({
                type: "allData",
                code: code,
                input: input,
                language: language,
                currentButtonState: currentButtonState,
                isLoading: isLoading,
                userId: data.userId
              })
            );
          }
        }

        // on receive all data
        if (data.type === "allData") {
          setCode(data.code);
          setInput(data.input);
          setLanguage(data.language);
          setCurrentButtonState(data.currentButtonState);
          setIsLoading(data.isLoading);
        }
      };
    }
  }, [code, input, language, currentButtonState, isLoading, socket, connectedUsers]);

  // Scroll to the bottom of the AI chat on new message
  useEffect(() => {
    aiChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);


  const handleSubmit = async () => {
    handleButtonStatus("Submitting...", true);
    setOutput([]); // Clear previous output
    const submission = {
      code,
      language,
      roomId: user.roomId,
      input
    };

    try {
      const res = await fetch(`http://${IP_ADDRESS}:3000/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submission),
      });

      handleButtonStatus("Compiling...", true);

      if (!res.ok) {
        setOutput((prevOutput) => [
          ...prevOutput,
          "Error submitting code. Please try again.",
        ]);
        handleButtonStatus("Run Code", false);
      }
    } catch (error) {
      console.error("Submission failed:", error);
      setOutput((prevOutput) => [
        ...prevOutput,
        "Failed to connect to the execution server.",
      ]);
      handleButtonStatus("Run Code", false);
    }
  };

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim() || isAiLoading) return;

    const userMessage: AiMessage = { sender: 'user', text: aiInput };
    setAiMessages(prev => [...prev, userMessage]);
    const currentAiInput = aiInput;
    setAiInput("");
    setIsAiLoading(true);

    // System prompt to guide the AI's behavior
    const systemPrompt = `You are an expert programming tutor. Your goal is to help a student learn by guiding them to the solution, not giving it away.
    Analyze the user's code, their provided input, and the resulting output.
    Provide hints, ask leading questions, and explain concepts.
    Do not write the correct code for them unless they are completely stuck and explicitly ask for the solution.
    Keep your responses concise and encouraging.`;

    // Construct the context-rich prompt for the AI
    const userQuery = `
      Here is my current situation:
      Language: ${language}
      Code:
      \`\`\`${language}
      ${code}
      \`\`\`
      Input given to the code:
      \`\`\`
      ${input || "No input provided."}
      \`\`\`
      Output from the code:
      \`\`\`
      ${output.join('\n') || "No output yet."}
      \`\`\`
      My question is: ${currentAiInput}
    `;

    try {
      const apiKey = ""; // Leave empty, will be handled by environment
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

      const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`API call failed with status: ${response.status}`);
      }

      const result = await response.json();
      const candidate = result.candidates?.[0];

      let aiResponseText = "Sorry, I couldn't generate a response. Please try again.";
      if (candidate && candidate.content?.parts?.[0]?.text) {
        aiResponseText = candidate.content.parts[0].text;
      }

      const aiMessage: AiMessage = { sender: 'ai', text: aiResponseText };
      setAiMessages(prev => [...prev, aiMessage]);

    } catch (error) {
      console.error("Error calling Gemini API:", error);
      const errorMessage: AiMessage = { sender: 'ai', text: "There was an error connecting to the AI assistant. Please check the console for details." };
      setAiMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsAiLoading(false);
    }
  };


  // handle input change multiple user
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInput(newValue);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "input",
          input: newValue,
          roomId: user.roomId
        })
      );
    }
  }

  // handle language change multiple user
  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "language",
          language: value,
          roomId: user.roomId
        })
      );
    }
  }

  // handle submit button status multiple user
  const handleButtonStatus = (value: string, isLoading: boolean) => {
    setCurrentButtonState(value);
    setIsLoading(isLoading);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "submitBtnStatus",
          value: value,
          isLoading: isLoading,
          roomId: user.roomId
        })
      );
    }
  }

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editor.onDidChangeModelContent(() => {
      const currentCode = editor.getValue();
      // Only send if the code has actually changed to avoid loops
      if (currentCode !== code && socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "code",
            code: currentCode,
            roomId: user.roomId
          })
        );
      }
    });
  };

  return (
    <div className="min-h-screen bg-black text-gray-300 font-sans p-4">
      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-2rem)]">

        {/* Left Side: Code Editor */}
        <div className="flex flex-col w-full lg:w-2/3">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-200">Code Together</h1>
            <div className="flex gap-4 items-center">
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-300"
              >
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="cpp">C++</option>
                <option value="java">Java</option>
                <option value="rust">Rust</option>
                <option value="go">Go</option>
              </select>
              <button
                onClick={handleSubmit}
                className={`bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md shadow-lg transition-all duration-300 transform flex items-center justify-center gap-2 ${isLoading ? 'opacity-60 cursor-not-allowed' : 'hover:scale-105'}`}
                disabled={isLoading}
              >
                {isLoading && <AiOutlineLoading3Quarters className="animate-spin" />}
                <span>{currentButtonState}</span>
              </button>
            </div>
          </div>
          <div className="border border-gray-800 rounded-lg overflow-hidden shadow-2xl flex-grow">
            <MonacoEditor
              value={code}
              language={language}
              theme="vs-dark"
              onMount={handleEditorDidMount}
              onChange={(value) => setCode(value)}
              options={{ minimap: { enabled: false }, fontSize: 14 }}
            />
          </div>
        </div>

        {/* Right Side: AI, I/O, and Users */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4">

          {/* AI Assistant */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-2xl flex flex-col flex-grow h-1/2">
            <h2 className="text-xl font-bold text-gray-300 p-3 border-b border-gray-800">AI Assistant</h2>
            <div className="flex-grow p-4 overflow-y-auto space-y-4">
              {aiMessages.length > 0 ? (
                aiMessages.map((msg, index) => (
                  <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                    {msg.sender === 'ai' && <div className="w-8 h-8 rounded-full bg-blue-500 flex-shrink-0 flex items-center justify-center font-bold">A</div>}
                    <div className={`max-w-xs md:max-w-md lg:max-w-sm rounded-lg px-4 py-2 ${msg.sender === 'user' ? 'bg-gray-700' : 'bg-gray-800'}`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center mt-4">Ask the AI for a hint or to explain a concept!</p>
              )}
              {isAiLoading && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex-shrink-0 flex items-center justify-center font-bold">A</div>
                  <div className="max-w-xs md:max-w-md lg:max-w-sm rounded-lg px-4 py-2 bg-gray-800">
                    <AiOutlineLoading3Quarters className="animate-spin text-gray-400" />
                  </div>
                </div>
              )}
              <div ref={aiChatEndRef} />
            </div>
            <form onSubmit={handleAiSubmit} className="p-3 border-t border-gray-800 flex gap-2">
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Chat with the AI..."
                className="bg-gray-800 border border-gray-700 text-white w-full p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                disabled={isAiLoading}
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-md disabled:opacity-50" disabled={isAiLoading || !aiInput.trim()}>
                <AiOutlineSend size={20} />
              </button>
            </form>
          </div>

          <div className="flex-grow flex flex-col gap-4 h-1/2">
            {/* Users & Room */}
            <div className="flex gap-4">
              <div className="w-1/2 bg-gray-900 border border-gray-800 p-3 rounded-lg">
                <h2 className="text-lg font-semibold text-gray-400 mb-2">Users</h2>
                <div className="space-y-2 max-h-24 overflow-y-auto">
                  {connectedUsers.length > 0 ? (
                    connectedUsers.map((u: any) => (
                      <div key={u.id} className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">{u.name.charAt(0).toUpperCase()}</div>
                        <span className="text-sm">{u.name}</span>
                      </div>
                    ))
                  ) : <p className="text-gray-500 text-sm">No other users.</p>}
                </div>
              </div>
              <div className="w-1/2 bg-gray-900 border border-gray-800 p-3 rounded-lg">
                <h2 className="text-lg font-semibold text-gray-400 mb-2">Invite Code</h2>
                <p className="text-green-400 font-mono bg-gray-800 p-2 rounded select-all" onClick={() => navigator.clipboard.writeText(user.roomId)}>{user.roomId || '...'}</p>

              </div>
            </div>

            {/* Input & Output */}
            <div className="flex-grow flex gap-4">
              <div className="w-1/2 flex flex-col">
                <h2 className="text-lg font-semibold text-gray-400 mb-2">Input</h2>
                <textarea
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Enter input..."
                  className="bg-gray-800 border border-gray-700 text-white w-full p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm flex-grow"
                />
              </div>
              <div className="w-1/2 flex flex-col">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-lg font-semibold text-gray-400">Output</h2>
                  <button onClick={() => setOutput([])} className="text-red-500 hover:text-red-400 text-sm">Clear</button>
                </div>
                <div className="bg-gray-800 border border-gray-700 text-green-400 p-2 rounded-md flex-grow overflow-y-auto font-mono text-sm">
                  {output.length > 0 ? output.map((line, index) => <pre key={index} className="whitespace-pre-wrap">{line}</pre>) : <p className="text-gray-500">No output yet.</p>}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default CodeEditor;

