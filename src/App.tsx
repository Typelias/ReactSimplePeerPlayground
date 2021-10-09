import React, { createElement, useEffect, useRef, useState } from 'react';
import './App.css';
import * as SignalR from "@microsoft/signalr";
import Peer from "simple-peer";
import styled from "styled-components";

const StyledVideo = styled.video`
  height: 40%;
  width: 50%
`

function App() {

  const [userSocket, setSocketArr] = useState<Array<string>>([]);
  const hubConnectionRef = useRef<SignalR.HubConnection>()
  const connections = useRef<Map<string, Peer.Instance>>(new Map<string, Peer.Instance>());
  const roomID = "Tjuvholmen";
  const [peerVideo, setPeerVideo] = useState<Array<MediaStream>>([]);


  function createPeer(userID: string): Peer.Instance {
    const peer = new Peer({
      initiator: false,
      trickle: false
    });
    peer.on('signal', data => {
      console.log(`Sending signaling data to ${userID}`);
      hubConnectionRef.current?.invoke("SendSignalData",
        userID,
        hubConnectionRef.current.connectionId,
        JSON.stringify(data)
      );
    });

    peer.on('connect', () => {
      console.log("Connected");
      peer.send(`Hello ${userID}`);
    })

    peer.on('data', data => {
      console.log(`Got data from ${userID} containing ${data}`);
    });
    return peer;
  }

  useEffect(() => {
    async function startConnection() {


      hubConnectionRef.current = new SignalR.HubConnectionBuilder()
        .withUrl("http://localhost:5000/signalrtc")
        .configureLogging(SignalR.LogLevel.Debug)
        .build();

      hubConnectionRef.current.on("AllUsers", (dataString: string) => {
        let userList: Array<string> = JSON.parse(dataString);
        userList.forEach((connectionID) => {
          connections.current.set(
            connectionID,
            createPeer(connectionID)
          );
        });

        setSocketArr(userList);
      });

      hubConnectionRef.current.on("NewUsers", (socketID: string) => {
        if (socketID === hubConnectionRef.current?.connectionId) return;
        setSocketArr(users => [...users, socketID]);
        const peer = new Peer({ initiator: true, trickle: false });
        peer.on('signal', data => {
          console.log(`Sending signaling data to ${socketID}`);
          hubConnectionRef.current?.invoke("SendSignalData",
            socketID,
            hubConnectionRef.current.connectionId,
            JSON.stringify(data)
          );
        });
        peer.on('connect', () => {
          console.log("Connected");
          peer.send(`Hello ${socketID}`);
        })

        peer.on('data', data => {
          console.log(`Got data from ${socketID} containing ${data}`);
        });

        connections.current.set(socketID, peer);

      });

      hubConnectionRef.current.on("RecivedSignalData", (reciver: string, sender: string, data: string) => {
        if (reciver !== hubConnectionRef.current?.connectionId) {
          console.log(`Recived messege to ${reciver} but I am ${hubConnectionRef.current?.connectionId}`);
          return;
        }
        console.log(`Recived signaling data from ${sender}`);
        const signalingData: Peer.SignalData = JSON.parse(data);
        const peer = connections.current.get(sender);
        peer?.signal(signalingData);
      });

      await hubConnectionRef.current.start();

      hubConnectionRef.current.invoke("JoinRoom", roomID);
    }

    startConnection();


  }, [])

  function addVideo(): void {
    navigator.mediaDevices.getUserMedia({ video: { height: 300, width: 300 }, audio: true }).then((stream) => {
      connections.current.forEach((peer, key) => {
        peer.addStream(stream);
      })
    })
  }

const Video = ({peer}: { peer: Peer.Instance }) => {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
      peer.on("stream", (stream: MediaStream) => {

        console.log("Got Stream");
          if(!ref.current) throw Error("Shit");

          console.log("Adding stream");
          ref.current.srcObject = stream;
      });
  }, []);

  return (
      <StyledVideo playsInline autoPlay ref={ref}/>
  );
}

  return (
    <div className="App">
      <div>
        <button onClick={addVideo}> Add Video </button>
        <h1>My ID: {hubConnectionRef ? hubConnectionRef.current?.connectionId : ""}</h1>
        <ul>
          {userSocket.map((socket, index) => {
            return (<li key={index}>{socket} </li>)
          })}
        </ul>
      </div>
      <div>
        {
          connections.current.forEach((peer, key) => {
            return <Video peer={peer} key={key}></Video>
          })
        })

      </div>

    </div>
  );
}

export default App;
