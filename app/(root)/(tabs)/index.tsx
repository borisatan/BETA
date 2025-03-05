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
      <Link href="/profile" className="my-4">Profile</Link>
      <Link href="/budget" className="my-4">Budget</Link>
      <Link href="/transaction-adder" className="my-4">Add Transaction</Link>
      <Link href="sign-in" className="my-4">Sign In</Link>
      <Link href="sign-up" className="my-4">Sign Up</Link>
    </View>
  );
}
