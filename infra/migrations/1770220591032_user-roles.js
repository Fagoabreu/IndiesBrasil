exports.up = (pgm) => {
  pgm.addColumns("portfolio_roles", {
    icon_img: {
      type: "varchar(256)",
    },
  });
  pgm.addColumns("portfolio_role_ref", {
    ordem: {
      type: "int",
      notNull: true,
      default: 0,
    },
  });

  pgm.alterColumn("portfolio_roles", "name", {
    type: "DEVELOPER_ROLE",
    using: "name::DEVELOPER_ROLE",
  });

  pgm.sql("ALTER TYPE public.experience_type ADD VALUE 'Estudante' before 'Junior';");
  pgm.sql("ALTER TYPE public.experience_type ADD VALUE 'Especialista' after 'Senior';");
  const sql = `
    ALTER TABLE public.portfolio_roles
    ALTER COLUMN name SET NOT NULL;

    ALTER TABLE public.portfolio_role_ref 
    drop CONSTRAINT portfolio_role_ref_portfolio_role_id_fkey;
    
    ALTER TABLE public.portfolio_roles
    DROP CONSTRAINT portfolio_roles_pkey;

    ALTER TABLE public.portfolio_roles
    ADD CONSTRAINT portfolio_roles_pkey PRIMARY KEY (name);

    ALTER TABLE public.portfolio_roles
    DROP COLUMN id;

    alter table public.portfolio_role_ref
    drop column portfolio_role_id;

    ALTER TABLE public.portfolio_role_ref
    ADD COLUMN portfolio_role_name public.developer_role;

    ALTER TABLE public.portfolio_role_ref 
      ADD CONSTRAINT portfolio_role_ref_portfolio_role_name_fkey 
      FOREIGN KEY (portfolio_role_name) 
      REFERENCES public.portfolio_roles(name);

    insert into portfolio_roles (name,icon_img)
      values
      ('2D Artist','2DArtist'),
      ('3D Artist','3DArtist'),
      ('Animator','Animator'),
      ('Associate Producer','AssociateProducer'),
      (' Community Manager','CommunityManager'),
      ('Composer','Composer'),
      ('Engine Programmer','EngineProgrammer'),
      ('Game Designer','GameDesigner'),
      ('Gameplay Programmer','GameplayProgrammer'),
      ('Game Producer','GameProducer'),
      ('Game Programmer','GameProgrammer'),
      ('Graphics Programmer','GraphicsProgrammer'),
      ('Level Designer','LevelDesigner'),
      ('Narrative Designer','NarrativeDesigner'),
      ('Sound Designer','SoundDesigner'),
      ('System Designer','SystemDesigner'),
      ('Technical Artist','TechnicalArtist'),
      ('Technical Designer','TechnicalDesigner'),
      ('Technical Director','TechnicalDirector'),
      ('Tester QA','TesterQA'),
      ('UI UX Designer','UIUXDesigner'),
      ('Writer','Writer');

    
  `;
  pgm.sql(sql);
};
