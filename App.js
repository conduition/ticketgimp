// Polyfill
import "react-zlib-js";

import { useMemo, useEffect, useState, useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Image, Text, View, TextInput } from "react-native";
import bwipjs from "bwip-js";
import * as b64 from "base-64";
import { Buffer } from "buffer";
import { WebView } from "react-native-webview";
import * as OTPAuth from "otpauth";
import { useAsyncStorage } from "@react-native-async-storage/async-storage";

const TOTP_STEP = 15;

const totp = (secret, now) =>
  new OTPAuth.TOTP({
    secret,
    period: TOTP_STEP,
  }).generate({ timestamp: now });

const unixNow = () => Math.floor(Date.now());

function generateSignedToken(ticket, time) {
  const parsedTicket = JSON.parse(Buffer.from(ticket, "base64").toString());

  const bearerKey = parsedTicket.t;
  const customerKey = Buffer.from(parsedTicket.ck, "hex");
  const eventKey = Buffer.from(parsedTicket.ek, "hex");

  const eventOTP = totp(eventKey, time);
  const customerOTP = totp(customerKey, time);
  const secs = Math.floor(time / 1000);
  return [bearerKey, eventOTP, customerOTP, secs].join("::");
}

function useSignedToken(ticket) {
  const [currentTime, setTime] = useState(0);
  const [currentCounter, setCounter] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const newTime = unixNow();
      const counter = Math.floor(newTime / (TOTP_STEP * 1000));
      if (counter !== currentCounter) {
        setCounter(counter);
        setTime(newTime);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [currentCounter]);

  const token = useMemo(() => {
    try {
      return generateSignedToken(ticket, currentTime);
    } catch (err) {
      return "";
    }
  }, [ticket, currentTime]);

  return token;
}

function Barcode({ text }) {
  const html = useMemo(() => {
    const uri =
      "data:image/svg+xml;base64," +
      b64.encode(
        bwipjs
          .toSVG({
            bcid: "pdf417",
            text,
          })
          .trim(),
      );
    return `<div><img src="${uri}"></div>`;
  }, [text]);

  return (
    <View style={styles.barcode}>
      <WebView style={styles.webview} source={{ html }} />
    </View>
  );
}

function Logo({ style }) {
  return (
    <Image style={style} source={require("./assets/flash-circuit-512.png")} />
  );
}

export default function App() {
  const [ticket, setTicket] = useState("");

  const ticketStorage = useAsyncStorage("ticket");
  useEffect(() => {
    ticketStorage.getItem((err, t) => {
      if (err) return console.error(err);
      if (t) setTicket(t);
    });
  }, []);

  const updateTicket = useCallback(
    (newTicket) => {
      setTicket(newTicket);
      ticketStorage.setItem(newTicket).catch(console.error);
    },
    [ticketStorage],
  );

  const [ticketInputStyle, setTicketInputStyle] = useState(
    styles.ticketInputBlurred,
  );
  const onFocusTicketInput = useCallback(() => {
    setTicketInputStyle(styles.ticketInputFocused);
  }, []);

  const onBlurTicketInput = useCallback(() => {
    setTicketInputStyle(styles.ticketInputBlurred);
  }, []);

  const token = useSignedToken(ticket);

  return (
    <View style={styles.container}>
      <Logo style={styles.logo} />
      <Text style={styles.title}>TicketGimp</Text>
      <TextInput
        placeholder="insert ticket here"
        placeholderTextColor="grey"
        value={ticket}
        selectTextOnFocus
        style={[styles.ticketInput, ticketInputStyle]}
        onChangeText={updateTicket}
        onFocus={onFocusTicketInput}
        onBlur={onBlurTicketInput}
      />
      {token ? <Barcode text={token} /> : <View style={{ flex: 1 }} />}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    backgroundColor: "#080c18",
    alignItems: "center",
  },
  logo: {
    position: "absolute",
    width: 40,
    height: 40,
    left: 25,
    top: 60,
  },
  ticketInput: {
    padding: 5,
    borderRadius: 5,
    backgroundColor: "#222",
    borderBottomWidth: 1,
    width: "80%",
    color: "white",
    margin: 50,
  },
  ticketInputFocused: {
    borderBottomWidth: 2,
    borderBottomColor: "#d500f9",
  },
  ticketInputBlurred: {
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  title: {
    flex: 1,
    color: "white",
    fontFamily: "monospace",
    fontSize: 40,
  },
  barcode: {
    flex: 3,
  },
  webview: {
    width: 350,
    flex: 0,
    height: 120,
  },
});
