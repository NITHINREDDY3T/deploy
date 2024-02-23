const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const app = express();
require('dotenv').config();

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  avatar: {
    data: Buffer,
    contentType: String,
  },
  bio: String,
});

const User = mongoose.model('User', userSchema);

const postSchema = new mongoose.Schema({
  title: String,
  link: String,
  category: String,
  content: String,
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  likes: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    },
  ],
  dislikes: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    },
  ],
  timestamp: {
    type: Date,
    default: Date.now,
  },
  comments: [
    {
      text: String,
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    },
  ],
  image: {
    data: Buffer,
    contentType: String,
  },
  poster: {
    data: Buffer,
    contentType: String,
},
});

const Post = mongoose.model('Post', postSchema);

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

function timeAgo(timestamp) {
  const now = new Date();
  const postedTime = new Date(timestamp);
  const timeDiff = now - postedTime;
  const seconds = Math.floor(timeDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return days + 'day(s) ago';
  } else if (hours > 0) {
    return hours + 'hrs ago';
  } else if (minutes > 0) {
    return minutes + 'min ago';
  } else {
    return 'Just now';
  }
}

app.get('/about-us', (req, res) => {
  res.render('about-us', { user: req.session.user });
});

app.get('/contact-us', (req, res) => {
  res.render('contact-us', { user: req.session.user });
});


const isLoggedIn = (req, res, next) => {
  if (req.session.user) {
    return next();
  } else {
    res.redirect('/login');
  }
};

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.get('/sign', (req, res) => {
  res.render('sign', { error: null });
});

app.post('/sign', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.render('sign', { error: 'Email already registered' });
    }

    const newUser = new User({
      username,
      email,
      password, 
      avatar: null, // Default avatar is null initially
      bio: 'Welcome to my profile!',
    });

    await newUser.save();
    console.log('User registered successfully.');
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    res.status(500).render('sign', { error: 'Internal server error' });
  }
});
app.post('/register', upload.single('avatar'), (req, res) => {
  // Process registration data, including avatar upload
  const { username, email, password, bio } = req.body;

  // Save the avatar URL (you may need to handle avatar storage properly based on your needs)
  const avatarUrl = req.file ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` : null;

  const newUser = new User({ username, email, bio, avatar: avatarUrl });
  User.register(newUser, password, (err, user) => {
      if (err) {
          console.error(err);
          return res.render('register', { error: err.message });
      }
      passport.authenticate('local')(req, res, () => {
          res.redirect('/');
      });
  });
});


app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.render('login', { error: 'Invalid email or password' });
    }

    // Replace with your login logic (e.g., password comparison)
    if (password !== user.password) {
      return res.render('login', { error: 'Invalid email or password' });
    }

    req.session.user = user;

    res.redirect('/'); // Added / to the route
  } catch (error) {
    console.error(error);
    res.status(500).render('login', { error: 'Internal server error' });
  }
});

app.get('/', async (req, res) => {
  const { search, category } = req.query;
  const filter = {};

  if (search) {
    filter.title = { $regex: new RegExp(search, 'i') };
  }

  if (category && category !== 'All') {
    filter.category = category;
  }

  try {
    const posts = await Post.find(filter)
      .populate('userId', 'username avatar bio') // Populate user details for each post
      .populate('comments.userId', 'username')
      .sort({ timestamp: -1 });

    const categorizedPosts = {};

    posts.forEach((post) => {
      if (!categorizedPosts[post.category]) {
        categorizedPosts[post.category] = [];
      }
      categorizedPosts[post.category].push(post);
    });

    res.render('index', {
      user: req.session.user,
      posts: categorizedPosts,
      error: null,
      timeAgo,
      search,
      selectedCategory: category || 'All',
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('index', {
      user: req.session.user,
      posts: {},
      error: 'Error fetching posts',
      timeAgo,
      search: '',
      selectedCategory: 'All',
    });
  }
});
app.get('/events', async (req, res) => {
  const { search, category } = req.query;
  const filter = {};

  if (search) {
    filter.title = { $regex: new RegExp(search, 'i') };
  }

  if (category && category !== 'All') {
    filter.category = category;
  }

  try {
    const posts = await Post.find(filter)
      .populate('userId', 'username avatar bio') // Populate user details for each post
      .populate('comments.userId', 'username')
      .sort({ timestamp: -1 });

    const categorizedPosts = {};

    posts.forEach((post) => {
      if (!categorizedPosts[post.category]) {
        categorizedPosts[post.category] = [];
      }
      categorizedPosts[post.category].push(post);
    });

    res.render('events', {
      user: req.session.user,
      posts: categorizedPosts,
      error: null,
      timeAgo,
      search,
      selectedCategory: category || 'All',
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('events', {
      user: req.session.user,
      posts: {},
      error: 'Error fetching posts',
      timeAgo,
      search: '',
      selectedCategory: 'All',
    });
  }
});



app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
    }
    res.redirect('/login');
  });
});



app.get('/post/:postId', async (req, res) => {
  const { postId } = req.params;

  try {
      const post = await Post.findById(postId);
      res.render('post-detail', { post, user: req.session.user });
  } catch (error) {
      console.error(error);
      res.status(500).render('error', { error: 'Internal server error' });
  }
});





app.post('/create-post', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'poster', maxCount: 1 }]), isLoggedIn, async (req, res) => {
  const { title, link, category, content } = req.body;
  const userId = req.session.user._id;
  const images = req.files['image'];
  const posters = req.files['poster'];

  try {
      const newPost = new Post({
          title,
          link,
          category,
          content,
          userId,
          image: images ? { data: images[0].buffer, contentType: images[0].mimetype } : undefined,
          poster: posters ? { data: posters[0].buffer, contentType: posters[0].mimetype } : undefined,
      });

      await newPost.save();
      console.log('Post created successfully.');
      res.redirect('/');
  } catch (error) {
      console.error(error);
      res.status(500).render('index', { error: 'Internal server error' });
  }
});


const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
