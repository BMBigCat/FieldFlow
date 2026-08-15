import { useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { captureRef } from "react-native-view-shot";

interface Props {
  onCapture: (localUri: string) => void;
  onCancel: () => void;
}

export function SignaturePad({ onCapture, onCancel }: Props) {
  const [paths, setPaths] = useState<string[]>([]);
  const currentPath = useRef<string>("");
  const [, forceRender] = useState(0);
  const containerRef = useRef<View>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        currentPath.current = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        forceRender((n) => n + 1);
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        currentPath.current += ` L${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        forceRender((n) => n + 1);
      },
      onPanResponderRelease: () => {
        if (currentPath.current) {
          setPaths((prev) => [...prev, currentPath.current]);
          currentPath.current = "";
        }
      },
    }),
  ).current;

  function clear() {
    setPaths([]);
    currentPath.current = "";
    forceRender((n) => n + 1);
  }

  async function save() {
    if (!containerRef.current) return;
    const uri = await captureRef(containerRef, { format: "png", quality: 1, result: "tmpfile" });
    onCapture(uri);
  }

  return (
    <View style={styles.wrap}>
      <View ref={containerRef} style={styles.canvas} {...panResponder.panHandlers} collapsable={false}>
        <Svg style={StyleSheet.absoluteFill}>
          {paths.map((d, i) => (
            <Path key={i} d={d} stroke="#111827" strokeWidth={3} fill="none" strokeLinecap="round" />
          ))}
          {currentPath.current !== "" && (
            <Path d={currentPath.current} stroke="#111827" strokeWidth={3} fill="none" strokeLinecap="round" />
          )}
        </Svg>
      </View>
      <View style={styles.row}>
        <Pressable style={styles.secondaryButton} onPress={clear}>
          <Text style={styles.secondaryButtonText}>Clear</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onCancel}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={save} disabled={paths.length === 0}>
          <Text style={styles.primaryButtonText}>Save Signature</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  canvas: {
    height: 180,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
