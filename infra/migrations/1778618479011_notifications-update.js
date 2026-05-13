exports.up = (pgm) => {
  const sql = `
    create table notification_messages(
      type notification_type not null,
      title varchar(64),
      message varchar(512),
      PRIMARY KEY(type),
      updated_at timestamptz default now()
    );

    insert into notification_messages (type,title,message)
    values
      ('new_follower','Novo Inscrito.','Um novo Inscrito.'),
      ('post_liked','Nova curtida.','Nova curtida no seu post %postId.'),
      ('post_commented','Novo comentário.','Usuario %userId comentou no Post %postId.'),
      ('portfolio_liked','Portfolio Curtido','Usuario %userId curtiu seu Portfolio');

    alter table notifications drop constraint notifications_event_id_fkey;
    alter table notifications drop column event_id;
    alter table notifications drop column message;
    alter table notifications rename to post_notifications;

    ALTER TABLE post_notifications
      ADD FOREIGN KEY(type) REFERENCES notification_messages(type)
      ON UPDATE NO ACTION ON DELETE NO ACTION;

    create table user_notifications(
      user_id uuid not null,
      type notification_type not null,
      source_user_id uuid not null,
      is_read boolean default false,

      PRIMARY KEY(user_id, type, source_user_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(type) REFERENCES notification_messages(type) ON DELETE CASCADE,
      FOREIGN KEY(source_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
      
  `;
  pgm.sql(sql);
};
