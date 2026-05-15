import TrendingTags from "../TrendingTags/TrendingTagsComponent";
import WhoToFollow from "../WhoToFollow/WhoToFollow";
import styles from "./PostRightBarComponent.module.css";

export default function PostRightBarComponent() {
  return (
    <div className={styles.rightBar}>
      <TrendingTags />
      <WhoToFollow />
    </div>
  );
}
