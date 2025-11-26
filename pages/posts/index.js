import { useEffect, useState } from "react";
import CreatePost from "@/components/CreatePost";
import PostCard from "@/components/PostCard";
import WhoToFollow from "@/components/WhoToFollow";
import { useUser } from "@/context/UserContext";

// fetchPosts e fetchDbUserId como antes

export default function PostsPage() {
  const { user, loadingUser } = useUser();
  const [posts, setPosts] = useState([]);
  const [dbUserId, setDbUserId] = useState(null);
  const [loadingPosts, setLoadingPosts] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoadingPosts(true);
      try {
        const [fetchedPosts, fetchedUserId] = await Promise.all([fetchPosts(), fetchDbUserId()]);
        setPosts(fetchedPosts || []);
        setDbUserId(fetchedUserId);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingPosts(false);
      }
    }
    loadData();
  }, []);

  const handleAddPost = (content) => {
    const newPost = {
      id: posts.length + 1,
      author: {
        id: dbUserId,
        name: user.name,
        username: user.username,
        avatarUrl: user.avatarUrl || "/images/avatar.png",
      },
      content,
      createdAt: new Date().toISOString(),
      likesCount: 0,
      likedByUser: false,
      commentsCount: 0,
    };
    setPosts([newPost, ...posts]);
  };

  const handleDeletePost = (postId) => {
    setPosts(posts.filter((p) => p.id !== postId));
  };

  if (loadingUser || loadingPosts) return <div style={{ padding: 32 }}>Carregando...</div>;

  return (
    <>
      {user && <CreatePost user={user} onPost={handleAddPost} />}
      {posts.map((post) => (
        <PostCard key={post.id} post={post} dbUserId={dbUserId} onDelete={handleDeletePost} />
      ))}
    </>
  );
}
