// Imports
const db = require('../models');
const jwtUtils = require('../utils/jwt.utils');
const fs = require('fs');
const user = require('./user');

// Routes
module.exports = {
    createPost: async function (req, res, next) {

        // Getting auth header
        const headerAuth = req.headers['authorization'];
        const userId = jwtUtils.getUserId(headerAuth);

        // Params
        const title = req.body.title;
        const description = req.body.description;
        let img_url;

        if (req.file) { img_url = req.file.path } 
        if ( description === null) {
            return res.status(400).json({ 'error': 'missing parameters' });
        }
        if ( description.length <= 2) {
            return res.status(400).json({ 'error': 'titre ou description trop cour' });
        }
        try {
            // récupère l'user
            const userFound = await db.User.findOne({ 
                where: { id: userId },
                attributes: ['id', 'first_name', 'last_name', 'createdAt', 'avatarUrl', 'sexe', 'isAdmin'],
            })
            if (userFound) {
                // on créé le post
                const newPost = await db.Post.create({
                    title: title ? title : null,
                    img_url: req.file ? `${req.protocol}://${req.get('host')}/images/static/assets/uploads/${req.file.filename}` : null,
                    description: description,
                    likes: 0,
                    comments: 0,
                    UserId: userFound.id,
                });

                if (newPost) {
                    res.locals.newPost = newPost
                    next()

                } else {
                    return res.status(500).json({ 'error': 'cannot create post' })
                }
            } else {
                return res.status(404).json({ 'error': 'user not found ou requete non authentifié' });
            }
        }
        catch (err) {
            console.error(err)
        }
    },


    postsNumber: async (req, res) => {

        // Getting auth header
        const headerAuth = req.headers['authorization'];
        const userId = jwtUtils.getUserId(headerAuth);

        // récupère l'user
        try {
            const userFound = await db.User.findOne({
                where: { id: userId },
                attributes: ['id']
            });
            if (userFound) {

                // récupère tout les posts
                const allPosts = await db.Post.findAll({
                    attributes: ['id']
                })

                if (allPosts) {
                    res.status(200).json(allPosts);
                } else {
                    return res.status(404).json({ "error": "no post fund" });
                }
            } else {
                return res.status(404).json({ 'error': 'user not found' });
            }
        } catch (err) {
            return console.error(err)
        };
    },



    listPosts: async (req, res) => {

        // Getting auth header
        const headerAuth = req.headers['authorization'];
        const userId = jwtUtils.getUserId(headerAuth);

        // Params
        const ITEMS_LIMIT = 10;
        const fields = req.query.fields;
        const limit = parseInt(req.query.limit);
        const offset = parseInt(req.query.offset);
        const order = req.query.order;

        if (limit > ITEMS_LIMIT) {
            limit = ITEMS_LIMIT;
        }

        // récupère l'user
        try {
            const userFound = await db.User.findOne({
                where: { id: userId },
                attributes: ['id', 'first_name', 'last_name', 'createdAt', 'updatedAt']
            });
            if (userFound) {

                // récupère tout les posts
                const allPosts = await db.Post.findAll({
                    order: [(order != null) ? order.split(':') : ['createdAt', 'DESC']],
                    attributes: (fields !== '*' && fields != null) ? fields.split(',') : null,
                    limit: (!isNaN(limit)) ? limit : null,
                    offset: (!isNaN(offset)) ? offset : null,
                    include: [{ 
                        model: db.User , attributes: ['first_name', 'last_name', 'avatarUrl'] 
                        },{
                        model: db.Like,
                            include: [{ model: db.User , attributes: ['first_name', 'last_name'] }]
                        },{
                        model: db.Comment,
                            include: [{ model: db.User, attributes: ['first_name', 'last_name', 'avatarUrl'] }]
                        }
                    ]
                })

                if (allPosts) {
                    res.status(200).json({allPosts: allPosts, user: userFound});
                } else {
                    return res.status(404).json({ "error": "no post fund" });
                }
            } else {
                return res.status(404).json({ 'error': 'user not found' });
            }
        } catch (err) {
            return console.error(err)
        };
    },


    selectOnePost: async (req, res) => {

        // Getting auth header
        const headerAuth = req.headers['authorization'];
        const userId = jwtUtils.getUserId(headerAuth);

        try {
            // récupère l'user
            const userFound = await db.User.findOne({
                where: { id: userId },
                attributes: ['id', 'first_name', 'last_name']
            })
            if (userFound) {

                // récupère le post
                const postFound = await db.Post.findOne({
                    where: { id: req.params.postId },
                    include: [{
                        model: db.User, attributes: ['first_name', 'last_name', 'avatarUrl'] 
                    },{
                        model: db.Like,
                        include: [{ model: db.User , attributes: ['first_name', 'last_name'] }]
                    },{
                        model: db.Comment,
                            include: [{ model: db.User, attributes: ['first_name', 'last_name', 'avatarUrl'] }]
                        }
                    ]
                })
                if (postFound) {
                    res.status(200).json({post : postFound, user: userFound}); 
                } else {
                    res.status(404).json({ "error": "no post fund" });
                }
            } else {
                return res.status(404).json({ 'error': 'user not found' });
            }
        } catch (err) {
            console.error(err)
        };
    },



    updateOnePost: async (req, res, next) => {

        // Getting auth header
        const headerAuth = req.headers['authorization'];
        const userId = jwtUtils.getUserId(headerAuth);
        const postId = JSON.parse(req.params.postId);

        //Params
        const title = req.body.title;
        let img_url;
        const description = req.body.description;

        if (req.file) { img_url = req.file.path }
        try {
            // on cherche l'utilisateur
            const userFound = await db.User.findOne({
                where: { id: userId }
            })
            if (userFound) {

                // on cherche le post souhaité dans la requete
                const postFound = await db.Post.findOne({
                    where: { id: postId }
                })
                if (postFound) {

                    // on verifie que la post a été créé par le proprio
                    if (userId === postFound.UserId || userFound.isAdmin === true) {

                        // update post
                        const postUpdate = await postFound.update({
                            title: (title ? title : postFound.title),
                            img_url: img_url ? `${req.protocol}://${req.get('host')}/images/static/assets/uploads/${req.file.filename}` : postFound.img_url,
                            description: (description ? description : postFound.description)
                        })
                        if (postUpdate) {
                            res.locals.postUpdate = postUpdate
                            next()
                        }
                    } else {
                        return res.status(201).json({ 'error': 'non autorisé' })
                    }
                } else {
                    return res.status(201).json({ 'error': 'post not found' })
                }
            } else {
                res.status(404).json({ 'error': 'user not found' });
            }
        } catch (err) {
            console.error(err)
        };
    },



    removeOnePost: async (req, res) => {

        // Getting auth header
        const headerAuth = req.headers['authorization'];
        const userId = jwtUtils.getUserId(headerAuth);
        const postId = req.params.postId;

        try {
            // on cherche l'utilisateur
            const userFound = await db.User.findOne({
                where: { id: userId }
            })
            if (userFound) {

                // on cherche le post
                const postFound = await db.Post.findOne({
                    where: { id: postId }
                })
                if (postFound) {
                    
                    // on verifie la légitimité
                    if (postFound.UserId === userFound.id || userFound.isAdmin) {

                        // on cherche les commentaires
                        const commentsFound = await db.Comment.findAll({
                            where: { postId: postId }
                        })

                        if (commentsFound) {
                            // on supprimes les commentaires
                            const destroyComments = await db.Comment.destroy({
                                where: { postId: postId }
                            })
                            if (destroyComments) {
                                //res.status(202).json({ 'message': 'Comments removed' })
                            } 
                        }

                        //on cherche les likes
                        const likesFound = await db.Like.findAll({
                            where: { postId : postId}
                        })
                        
                        if (likesFound) {
                            // on supprimes les like
                            const destroyLikes = await db.Like.destroy({
                                where: { postId: postId }
                            })
                        }
                        
                        //on cherche l'image
                        const imageFound = await db.Image.findOne({
                            where: { id : req.params.postId}
                        })
                        if(imageFound) {

                            // on supprime l'image de la database
                            const destroyImage = await db.Image.destroy({
                                where: { id: req.params.postId }
                            })
                            if (destroyImage) {

                                if(imageFound.url != null) {
                                    // supprime l'image
                                    fs.unlink(imageFound.url,(err) =>{
                                        if (err) {
                                          console.error(err)
                                        } else {
                                          console.log('image supprimé')
                                        }
                                    })
                                }
                            }
                        }

                        // Supprime le post
                        const destroyPost = await db.Post.destroy({
                            where: { id: postId }
                        })
                        if (destroyPost) {
                            res.status(202).json({ 'message': 'Post deleted' })
                        }
                        else {
                            res.status(500).json({ 'error': 'cannot destroy post' });
                        };

                    } else {
                        res.status(404).json({ 'error': 'no permission' });
                    }
                } else {
                    res.status(404).json({ 'error': 'post not found' });
                }
            } else {
                res.status(404).json({ 'error': 'user not found' });
            }
        } catch (err) {
            console.error(err)
        };
    },

}




