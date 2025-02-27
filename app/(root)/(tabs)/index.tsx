import { Text, View } from "react-native";
import { Link } from "expo-router";

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text className="font-bold text-lg my-4">Welcome to Restate</Text>
      <Link href="/profile">Profile</Link>
      <Link href="/base-page">Front Page</Link>
      <Link href="/sign-in">Sign In</Link>
    </View>
  );
}
